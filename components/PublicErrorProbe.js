"use client";

import { useEffect, useState } from "react";

export default function PublicErrorProbe() {
  const [fail, setFail] = useState(false);
  useEffect(() => setFail(true), []);
  if (fail) throw new Error("PUBLIC_ERROR_BOUNDARY_TEST");
  return null;
}
