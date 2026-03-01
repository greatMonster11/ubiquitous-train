import fs from "fs";
import pdf from "pdf-lib";
import {
  extractTextFromPDF,
  findEmailCoordinates,
  findPhoneCoordinates,
  findLinkedInCoordinates,
  removeLinksFromPDF,
} from "./extractor.js";
import axios from "axios";

async function createCoverPatch(pdfData, outputPath) {
  try {
    const pdfDoc = await pdf.PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();
    const extractedText = await extractTextFromPDF(pdfData);

    const emailCoords = findEmailCoordinates(extractedText);
    // console.log("emailCoord:::", emailCoords);
    const phoneCoords = findPhoneCoordinates(extractedText);
    // console.log("phoneCoords:::", phoneCoords);
    const linnkedInCoords = await findLinkedInCoordinates(pdfData);
    // console.log("linnkedInCoords:::", linnkedInCoords);

    for (const page of pages) {
      const pageIndex = pages.indexOf(page) + 1;
      const emailCoordsForPage = emailCoords.filter(
        (coord) => coord.page === pageIndex,
      );
      const phoneCoordsForPage = phoneCoords.filter(
        (coord) => coord.page === pageIndex,
      );
      const linkedInCoordsForPage = linnkedInCoords.filter(
        (coord) => coord.page === pageIndex,
      );

      applyPatches(page, emailCoordsForPage);
      applyPatches(page, phoneCoordsForPage);
      applyPatches(page, linkedInCoordsForPage);
    }

    let pdfBytes = await pdfDoc.save();
    // pdfBytes = await removeLinksFromPDF(pdfBytes);
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`Cover patch created successfully in ${outputPath}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

function applyPatches(page, coordinates) {
  for (const coords of coordinates) {
    page.drawText("".padStart(coords.str.length, " "), {
      x: coords.x,
      y: coords.y,
    });
    page.drawRectangle({
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.fontSize || coords.height,
      color: pdf.rgb(0, 0, 0),
    });
  }
}

// Example usage:
// const inputPath =
// "/Users/npthanh/Documents/classic-ms-word-resume-template.pdf";
// "/Users/npthanh/Downloads/Hoa_Do-_CV_-_Hoa_Do.pdf";
// "/Users/npthanh/Downloads/[Resume][Developer] Phuoc Thanh v2.pdf";
// "/Users/npthanh/Downloads/CV_Middle.pdf"; // what the fuck is this?
// "/Users/npthanh/Downloads/Georgios_CV-CPO.pdf";
// "/Users/npthanh/Downloads/resume-gia.pdf";
// "/Users/npthanh/Downloads/classic-ms-word-resume-template.pdf";
//
const url =
  // "https://storage.googleapis.com/featurii-dev/2025/01/06/08_32_54/vdp7b/classic-ms-word-resume-template.pdf";
  // "https://storage.googleapis.com/featurii-dev/2024/12/31/14_28_13/7guec/CV-Phan-Hai-Dang.pdf";
  // "https://storage.googleapis.com/featurii-dev/2025/01/02/08_51_54/61g6a/CV_Hako_UIUXDesigner.pdf";
  // "https://storage.googleapis.com/featurii-dev/2024/12/31/13_34_28/zba9n/Steven_Tran's_Resume.pdf";
  // "https://storage.googleapis.com/featurii-dev/application/pdf/2025/01/10/14_28_16/cx2n4/masked_CV_test.pdf";
  // "https://storage.googleapis.com/featurii-dev/2025/01/10/02_34_10/47t1v/CV_test.pdf";
  "https://storage.googleapis.com/featurii-dev/2024/12/31/13_50_56/2vpgy/LE_NGUYEN_MINH_NHUT_-_MARKETING_-_0827707893.pdf";
const outputPath = "/Users/npthanh/Documents/output_patched.pdf";

// createCoverPatch(inputPath, outputPath);

async function main(url, output) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const pdfData = res.data;
  // console.log(pdfData);
  await createCoverPatch(pdfData, output);
}

main(url, outputPath);
