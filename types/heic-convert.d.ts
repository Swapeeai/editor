declare module "heic-convert/browser" {
  type HeicConvert = (options: {
    buffer: Uint8Array
    format: "JPEG"
    quality?: number
  }) => Promise<Uint8Array>
  const convert: HeicConvert
  export default convert
}
