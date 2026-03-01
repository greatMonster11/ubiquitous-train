import { getDocument } from "pdfjs-dist/legacy/build/pdf.min.mjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function extractTextFromPDF(input) {
  const pdfData = new Uint8Array(input);
  const doc = await getDocument({ data: pdfData }).promise;
  const numPages = doc.numPages;

  const textWithCoords = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      textWithCoords.push({
        str: item.str,
        x: item.transform[4], // Transform matrix values for x and y coordinates
        y: item.transform[5],
        width: item.width,
        height: item.height,
        page: i,
        fontSize: item.transform[0], // Transform matrix values for font size
      });
    }
  }

  return textWithCoords;
}

export function findEmailCoordinates(textWithCoords) {
  const emailCoordinates = [];
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

  for (let i = 0; i < textWithCoords.length; i++) {
    let combinedStr = textWithCoords[i].str;
    let j = i + 1;

    while (
      j < textWithCoords.length &&
      textWithCoords[j].y === textWithCoords[i].y
    ) {
      combinedStr += textWithCoords[j].str;
      j++;
    }

    if (emailRegex.test(combinedStr)) {
      textWithCoords[i].y -= 8;
      if (textWithCoords[i].height) textWithCoords[i].height *= 1.6;
      emailCoordinates.push(
        createCoordinateObject(textWithCoords[i], combinedStr),
      );
      i = j - 1;
    }
  }

  return emailCoordinates;
}

export function findPhoneCoordinates(textWithCoords) {
  const phoneCoordinates = [];
  const phoneRegex =
    /(\+?\d{1,4}[\s-.]?)?(\(?\d{1,4}\)?[\s-.]?)?(\d{1,4}[\s-.]?)?(\d{1,4}[\s-.]?)?(\d{1,4})/g;

  for (let i = 0; i < textWithCoords.length; i++) {
    let combinedStr = textWithCoords[i].str;
    let j = i + 1;

    while (
      j < textWithCoords.length &&
      textWithCoords[j].y === textWithCoords[i].y
    ) {
      if (textWithCoords[j].str === " ") {
        combinedStr += "-";
      } else {
        combinedStr += textWithCoords[j].str;
      }
      j++;
    }

    const matches = combinedStr.match(phoneRegex);
    if (matches) {
      for (const match of matches) {
        if (
          match.length >= 7 &&
          match.length <= 15 &&
          isValidPhoneNumber(match)
        ) {
          const indexOfMatch = combinedStr.indexOf(match) || 1;

          if (indexOfMatch > 1) {
            textWithCoords[i].x =
              textWithCoords[i].x +
              indexOfMatch * (Math.floor(textWithCoords[i].fontSize) || 8);
          }
          textWithCoords[i].y -= 8;
          phoneCoordinates.push(
            createCoordinateObject(textWithCoords[i], match),
          );
        }
      }
      i = j - 1;
    }
  }

  return phoneCoordinates;
}

export async function findLinkedInCoordinates(input) {
  const pdfData = new Uint8Array(input);
  const doc = await getDocument({ data: pdfData }).promise;
  const numPages = doc.numPages;

  const linkedInCoordinates = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = await page.getAnnotations();

    for (const annotation of annotations) {
      if (annotation.subtype === "Link" && annotation.url) {
        const linkedInRegex =
          /https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i;
        if (linkedInRegex.test(annotation.url)) {
          linkedInCoordinates.push({
            str: annotation.url,
            x: annotation.rect[0],
            y: annotation.rect[1],
            width: annotation.rect[2] - annotation.rect[0],
            height: annotation.rect[3] - annotation.rect[1],
            page: i,
          });
        }
      }
    }
  }

  return linkedInCoordinates;
}

function createCoordinateObject(item, str) {
  if (!str) return null;
  return {
    str,
    x: item.x,
    y: item.y,
    width: str.length * Math.floor(item.fontSize) || 50,
    height: item.height || Math.floor(item.fontSize + 15),
    page: item.page,
  };
}

function getCharacterWidths(str, fontSize) {
  // This method should return an array of widths for each character in the string
  // For simplicity, we'll assume a fixed width for each character here
  // In a real scenario, you might use a library to measure text width more accurately
  const averageCharWidth = fontSize * 0.6; // Assuming an average character width based on font size
  return Array.from(str).map(() => averageCharWidth);
}

function isValidPhoneNumber(phoneNumber) {
  // Refine the phone number validation to exclude date ranges and other non-phone number patterns
  const phoneRegex =
    /^(\+?\d{1,4}[\s-.]?)?(\(?\d{1,4}\)?[\s-.]?)?(\d{1,4}[\s-.]?)?(\d{1,4}[\s-.]?)?(\d{1,4})$/;
  const dateRegex = /\b\d{2}[\/.-]\d{4,5}\b/; // Matches date patterns like 05/2018

  return phoneRegex.test(phoneNumber) && !dateRegex.test(phoneNumber);
}

export async function removeLinksFromPDF(input) {
  const pdfDoc = await PDFDocument.load(input);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const annotations = page.node.Annots();
    if (annotations) {
      annotations.remove();
    }
  }

  const textWithCoords = await extractTextFromPDF(input);
  const emailCoordinates = findEmailCoordinates(textWithCoords);
  const phoneCoordinates = findPhoneCoordinates(textWithCoords);

  for (const email of emailCoordinates) {
    const page = pages[email.page - 1];
    page.drawText("ENCRYPTED", {
      x: email.x,
      y: email.y,
      size: email.height,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(1, 0, 0),
    });
  }

  for (const phone of phoneCoordinates) {
    const page = pages[phone.page - 1];
    page.drawText("ENCRYPTED", {
      x: phone.x,
      y: phone.y,
      size: phone.height,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(1, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
