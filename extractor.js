import { getDocument } from "pdfjs-dist/legacy/build/pdf.min.mjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const DEFAULT_LINE_Y_TOLERANCE = 2.2;

export async function extractTextFromPDF(input) {
  const pdfData = new Uint8Array(input);
  const doc = await getDocument({ data: pdfData }).promise;
  const numPages = doc.numPages;

  const textWithCoords = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      const fontScaleX = Number(item.transform?.[0]) || 0;
      const fontScaleY = Number(item.transform?.[3]) || 0;
      const derivedFontSize =
        Math.max(Math.abs(fontScaleX), Math.abs(fontScaleY)) ||
        Number(item.height) ||
        10;
      textWithCoords.push({
        str: item.str,
        x: Number(item.transform?.[4]) || 0,
        y: Number(item.transform?.[5]) || 0,
        width: Number(item.width) || 0,
        height: Number(item.height) || derivedFontSize,
        page: i,
        fontSize: derivedFontSize,
      });
    }
  }

  return textWithCoords;
}

export function findEmailCoordinates(textWithCoords) {
  const emailCoordinates = [];
  const emailCandidateRegex =
    /[A-Z0-9._%+-]+(?:\s*[._%+-]\s*[A-Z0-9._%+-]+)*\s*@\s*[A-Z0-9.-]+(?:\s*\.\s*[A-Z]{2,})+/gi;
  const strictEmailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const lines = buildTextLines(textWithCoords);

  for (const line of lines) {
    let match;
    while ((match = emailCandidateRegex.exec(line.text)) !== null) {
      const normalizedEmail = match[0].replace(/\s+/g, "");
      if (!strictEmailRegex.test(normalizedEmail)) {
        continue;
      }

      const coordinate = createCoordinateFromMatchRange(
        line,
        match.index,
        match.index + match[0].length,
        normalizedEmail,
      );
      if (coordinate) {
        emailCoordinates.push(coordinate);
      }
    }
  }

  return dedupeCoordinates(emailCoordinates);
}

export function findPhoneCoordinates(textWithCoords) {
  const phoneCoordinates = [];
  const phoneCandidateRegex =
    /(?:\+?\d[\d().\s-]{5,}\d)(?:\s*(?:ext\.?|x)\s*\d{1,5})?/gi;
  const lines = buildTextLines(textWithCoords);

  for (const line of lines) {
    let match;
    while ((match = phoneCandidateRegex.exec(line.text)) !== null) {
      const normalizedPhone = normalizePhoneCandidate(match[0]);
      if (!isValidPhoneNumber(normalizedPhone)) {
        continue;
      }

      const coordinate = createCoordinateFromMatchRange(
        line,
        match.index,
        match.index + match[0].length,
        normalizedPhone,
      );
      if (coordinate) {
        phoneCoordinates.push(coordinate);
      }
    }
  }

  return dedupeCoordinates(phoneCoordinates);
}

export function findLinkedInTextCoordinates(textWithCoords) {
  const linkedInCoordinates = [];
  const linkedInRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|company|school)\/[A-Za-z0-9_%-]+|lnkd\.in\/[A-Za-z0-9_%-]+)/gi;
  const lines = buildTextLines(textWithCoords);

  for (const line of lines) {
    let match;
    while ((match = linkedInRegex.exec(line.text)) !== null) {
      const coordinate = createCoordinateFromMatchRange(
        line,
        match.index,
        match.index + match[0].length,
        match[0],
      );
      if (coordinate) {
        linkedInCoordinates.push(coordinate);
      }
    }
  }

  return dedupeCoordinates(linkedInCoordinates);
}

export async function findLinkedInCoordinates(input, textWithCoords = null) {
  const pdfData = new Uint8Array(input);
  const doc = await getDocument({ data: pdfData }).promise;
  const numPages = doc.numPages;

  const linkedInCoordinates = [];
  const linkedInRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|company|school)\/[A-Za-z0-9_%-]+|lnkd\.in\/[A-Za-z0-9_%-]+)/i;

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = await page.getAnnotations();

    for (const annotation of annotations) {
      const annotationUrl = annotation.url || annotation.unsafeUrl;
      const hasValidRect =
        Array.isArray(annotation.rect) && annotation.rect.length >= 4;
      if (annotation.subtype === "Link" && annotationUrl && hasValidRect) {
        if (linkedInRegex.test(annotationUrl)) {
          linkedInCoordinates.push({
            str: annotationUrl,
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

  const extractedText = textWithCoords || (await extractTextFromPDF(pdfData));
  const linkedInTextCoordinates = findLinkedInTextCoordinates(extractedText);

  return dedupeCoordinates([
    ...linkedInCoordinates,
    ...linkedInTextCoordinates,
  ]);
}

function buildTextLines(textWithCoords, yTolerance = DEFAULT_LINE_Y_TOLERANCE) {
  const sortedTokens = [...textWithCoords]
    .filter(
      (item) => item && typeof item.str === "string" && item.str.length > 0,
    )
    .sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (Math.abs(a.y - b.y) > 0.001) return b.y - a.y;
      return a.x - b.x;
    });

  const lines = [];

  for (const token of sortedTokens) {
    const adaptiveTolerance = Math.max(
      yTolerance,
      (token.fontSize || 10) * 0.2,
    );
    let nearestLine = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const line of lines) {
      if (line.page !== token.page) {
        continue;
      }

      const distance = Math.abs(line.y - token.y);
      if (distance <= adaptiveTolerance && distance < nearestDistance) {
        nearestLine = line;
        nearestDistance = distance;
      }
    }

    if (!nearestLine) {
      lines.push({
        page: token.page,
        y: token.y,
        tokens: [token],
      });
      continue;
    }

    nearestLine.tokens.push(token);
    nearestLine.y =
      (nearestLine.y * (nearestLine.tokens.length - 1) + token.y) /
      nearestLine.tokens.length;
  }

  return lines.map((line) => buildLineTextMap(line));
}

function buildLineTextMap(line) {
  const tokens = [...line.tokens].sort((a, b) => a.x - b.x);
  let text = "";
  const charToTokenIndex = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenText = token.str || "";
    if (!tokenText) {
      continue;
    }

    if (i > 0) {
      const prev = tokens[i - 1];
      const prevRight = prev.x + Math.max(prev.width, 0);
      const gap = token.x - prevRight;
      const avgFontSize = ((prev.fontSize || 10) + (token.fontSize || 10)) / 2;
      const minGapForSpace = Math.max(1.2, avgFontSize * 0.2);
      const startsWithPunctuation = /^[,.;:!?)}\]]/.test(tokenText);
      const endsWithJoinChar = /[@(\[{]$/.test(text);

      if (
        gap > minGapForSpace &&
        !text.endsWith(" ") &&
        !startsWithPunctuation &&
        !endsWithJoinChar
      ) {
        text += " ";
        charToTokenIndex.push(-1);
      }
    }

    text += tokenText;
    for (let j = 0; j < tokenText.length; j++) {
      charToTokenIndex.push(i);
    }
  }

  return {
    page: line.page,
    text,
    tokens,
    charToTokenIndex,
  };
}

function createCoordinateFromMatchRange(line, start, end, str) {
  const tokenIndexes = new Set();

  for (let i = start; i < end && i < line.charToTokenIndex.length; i++) {
    const tokenIndex = line.charToTokenIndex[i];
    if (tokenIndex >= 0) {
      tokenIndexes.add(tokenIndex);
    }
  }

  if (tokenIndexes.size === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const index of tokenIndexes) {
    const token = line.tokens[index];
    const tokenWidth = Math.max(Number(token.width) || 0, 0);
    const tokenHeight = Math.max(
      Number(token.height) || 0,
      token.fontSize || 10,
    );
    const tokenLeft = Number(token.x) || 0;
    const tokenBottom = Number(token.y) || 0;
    const tokenRight = tokenLeft + tokenWidth;
    const tokenTop = tokenBottom + tokenHeight;

    minX = Math.min(minX, tokenLeft);
    minY = Math.min(minY, tokenBottom);
    maxX = Math.max(maxX, tokenRight);
    maxY = Math.max(maxY, tokenTop);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    str,
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    page: line.page,
  };
}

function dedupeCoordinates(coordinates) {
  const unique = new Map();

  for (const coordinate of coordinates) {
    const key = [
      coordinate.page,
      Math.round(coordinate.x * 10),
      Math.round(coordinate.y * 10),
      Math.round(coordinate.width * 10),
      Math.round(coordinate.height * 10),
    ].join(":");

    if (!unique.has(key)) {
      unique.set(key, coordinate);
    }
  }

  return [...unique.values()];
}

function normalizePhoneCandidate(phoneNumber) {
  return phoneNumber.replace(/\s+/g, " ").trim();
}

function isValidPhoneNumber(phoneNumber) {
  const value = phoneNumber.trim();
  if (!value) {
    return false;
  }

  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return false;
  }

  if (/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(value)) {
    return false;
  }

  if (/\b\d{4}\s*[-–]\s*\d{4}\b/.test(value)) {
    return false;
  }

  if (/\b(?:19|20)\d{2}\b/.test(value) && digitsOnly.length <= 8) {
    return false;
  }

  if (/[A-Za-z]{4,}/.test(value) && !/(ext\.?|x\s*\d{1,5})$/i.test(value)) {
    return false;
  }

  if (!/[+()\s.-]/.test(value) && digitsOnly.length < 9) {
    return false;
  }

  return true;
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
