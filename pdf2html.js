import pdf2html from "pdf2html";
import fs from "fs";

const inputPath =
  // "/Users/npthanh/Documents/classic-ms-word-resume-template.pdf";
  // "/Users/npthanh/Downloads/Hoa_Do-_CV_-_Hoa_Do.pdf";
  // "/Users/npthanh/Downloads/[Resume][Developer] Phuoc Thanh v2.pdf";
  "/Users/npthanh/Downloads/CV_Middle.pdf"; // what the fuck is this?
  // "/Users/npthanh/Downloads/Georgios_CV-CPO.pdf";
  // "/Users/npthanh/Downloads/resume-gia.pdf";
  // "/Users/npthanh/Downloads/classic-ms-word-resume-template.pdf";

const html = await pdf2html.html(inputPath);

console.log(typeof html);

console.log(html);
