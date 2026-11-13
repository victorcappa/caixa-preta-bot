// Adapted from plateia-point-cloud/estimar-profundidade.swift and carregar_nuvem.
// Relative monocular depth, not a calibrated scan. Input photos never leave this process.
import CoreGraphics
import CoreML
import CoreVideo
import Foundation
import ImageIO

func event(_ fields: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: fields), let text = String(data: data, encoding: .utf8) {
        print(text); fflush(stdout)
    }
}
enum CloudError: Error { case unreadableImage, invalidModel, invalidDepth, bufferCreation }
func progress(_ amount: Int, _ phase: String) { event(["progress": amount, "phase": phase]) }
func pixels(_ image: CGImage, _ width: Int, _ height: Int) throws -> [UInt8] {
    var data = [UInt8](repeating: 0, count: width * height * 4)
    guard let space = CGColorSpace(name: CGColorSpace.sRGB) else { throw CloudError.bufferCreation }
    let ok = data.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height)); return true
    }
    if !ok { throw CloudError.bufferCreation }
    return data
}
func inputBuffer(_ image: CGImage, _ width: Int, _ height: Int) throws -> CVPixelBuffer {
    var candidate: CVPixelBuffer?
    let status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
        [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &candidate)
    guard status == kCVReturnSuccess, let buffer = candidate else { throw CloudError.bufferCreation }
    CVPixelBufferLockBaseAddress(buffer, []); defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let space = CGColorSpace(name: CGColorSpace.sRGB), let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: space,
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue) else { throw CloudError.bufferCreation }
    context.interpolationQuality = .high; context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height)); return buffer
}
func depthValues(_ buffer: CVPixelBuffer) throws -> (values: [Float], width: Int, height: Int) {
    let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer), stride = CVPixelBufferGetBytesPerRow(buffer)
    let format = CVPixelBufferGetPixelFormatType(buffer)
    guard format == kCVPixelFormatType_OneComponent16Half || format == kCVPixelFormatType_OneComponent32Float else { throw CloudError.invalidDepth }
    CVPixelBufferLockBaseAddress(buffer, .readOnly); defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let address = CVPixelBufferGetBaseAddress(buffer) else { throw CloudError.invalidDepth }
    var values = [Float](repeating: 0, count: width * height)
    for y in 0..<height {
        let row = address.advanced(by: y * stride)
        for x in 0..<width {
            values[y * width + x] = format == kCVPixelFormatType_OneComponent16Half
                ? Float(Float16(bitPattern: row.assumingMemoryBound(to: UInt16.self)[x])) : row.assumingMemoryBound(to: Float.self)[x]
        }
    }
    let finite = values.filter { $0.isFinite }.sorted()
    guard !finite.isEmpty else { throw CloudError.invalidDepth }
    let low = finite[Int(Double(finite.count - 1) * 0.02)], high = finite[Int(Double(finite.count - 1) * 0.98)]
    let span = max(high - low, 1e-8), median = finite[finite.count / 2]
    for i in values.indices { values[i] = min(1, max(0, ((values[i].isFinite ? values[i] : median) - low) / span)) }
    return (values, width, height)
}
func append<T>(_ value: T, to data: inout Data) { var copy = value; withUnsafeBytes(of: &copy) { data.append(contentsOf: $0) } }
func run() throws {
    guard CommandLine.arguments.count == 4 else { throw CloudError.invalidModel }
    let start = ProcessInfo.processInfo.systemUptime
    progress(15, "image")
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1800] as CFDictionary) else { throw CloudError.unreadableImage }
    progress(25, "model")
    let config = MLModelConfiguration()
    if ProcessInfo.processInfo.environment["PLATEIA_COREML_CPU"] == "1" { config.computeUnits = .cpuOnly }
    let model = try MLModel(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]), configuration: config)
    guard let constraint = model.modelDescription.inputDescriptionsByName["image"]?.imageConstraint else { throw CloudError.invalidModel }
    let buffer = try inputBuffer(image, constraint.pixelsWide, constraint.pixelsHigh)
    progress(40, "depth")
    let prediction = try model.prediction(from: MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(pixelBuffer: buffer)]))
    guard let map = prediction.featureValue(for: "depth")?.imageBufferValue else { throw CloudError.invalidDepth }
    let depth = try depthValues(map)
    progress(70, "points")
    let scale = min(1, 1024.0 / Double(max(image.width, image.height)))
    let width = max(1, Int((Double(image.width) * scale).rounded())), height = max(1, Int((Double(image.height) * scale).rounded()))
    let rgb = try pixels(image, width, height), focal = Float(max(width, height)) * 0.95
    var data = Data("CPPC".utf8)
    append(UInt32(1).littleEndian, to: &data); append(UInt32(width * height).littleEndian, to: &data); append(UInt32(15).littleEndian, to: &data)
    data.reserveCapacity(16 + width * height * 15)
    for row in 0..<height { for col in 0..<width {
        let dx = max(0, min(Float(depth.width - 1), (Float(col) + 0.5) * Float(depth.width) / Float(width) - 0.5))
        let dy = max(0, min(Float(depth.height - 1), (Float(row) + 0.5) * Float(depth.height) / Float(height) - 0.5))
        let x0 = Int(dx), y0 = Int(dy), x1 = min(x0 + 1, depth.width - 1), y1 = min(y0 + 1, depth.height - 1)
        let tx = dx - Float(x0), ty = dy - Float(y0)
        let top = depth.values[y0 * depth.width + x0] * (1 - tx) + depth.values[y0 * depth.width + x1] * tx
        let bottom = depth.values[y1 * depth.width + x0] * (1 - tx) + depth.values[y1 * depth.width + x1] * tx
        let z = 1 / (0.55 + 0.45 * (top * (1 - ty) + bottom * ty))
        let x = (Float(col) - Float(width - 1) * 0.5) * z / focal
        let y = (Float(height - 1) * 0.5 - Float(row)) * z / focal
        append(x.bitPattern.littleEndian, to: &data); append(y.bitPattern.littleEndian, to: &data); append(z.bitPattern.littleEndian, to: &data)
        let i = (row * width + col) * 4; data.append(rgb[i]); data.append(rgb[i + 1]); data.append(rgb[i + 2])
    } }
    progress(90, "writing")
    try data.write(to: URL(fileURLWithPath: CommandLine.arguments[3]), options: .atomic)
    event(["done": true, "pointCount": width * height, "durationMs": Int((ProcessInfo.processInfo.systemUptime - start) * 1000)])
}
do { try run() } catch {
    let code = (error as? CloudError) == .unreadableImage ? "UNREADABLE_IMAGE" : "CONVERSION_FAILED"
    event(["error": code]); exit(1)
}
