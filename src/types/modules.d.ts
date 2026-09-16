// 第三方库最小类型声明（这些库的类型链较重或不完整，这里只声明实际用到的 API）

declare module "pdf-parse" {
  export class PDFParse {
    constructor(options: { data: Uint8Array | ArrayBuffer; password?: string });
    getText(): Promise<{ text: string }>;
  }
}

declare module "mammoth" {
  const mammoth: {
    extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
  };
  export = mammoth;
}
