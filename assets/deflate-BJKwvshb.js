import { t as inflate_1 } from "./pako.esm-DawxUjt-.js";
import { t as BaseDecoder } from "./basedecoder-BdcHmq9y.js";
// node_modules/geotiff/dist-module/compression/deflate.js
var DeflateDecoder = class extends BaseDecoder {
	decodeBlock(buffer) {
		return inflate_1(new Uint8Array(buffer)).buffer;
	}
};
export { DeflateDecoder as default };
