const string = { type: "string" };
const paragraph={type:"array",minItems:1,maxItems:3,items:{type:"object",additionalProperties:false,required:["text","elementIds"],properties:{text:string,elementIds:{type:"array",items:string}}}};
export const tarotResponseSchema={type:"object",additionalProperties:false,required:["observation","interpretation","association"],properties:{observation:paragraph,interpretation:paragraph,association:paragraph}};
