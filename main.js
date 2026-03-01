import fs from "fs";
import path from "path";
import pdf from "pdf-lib";
import {
  extractTextFromPDF,
  findEmailCoordinates,
  findPhoneCoordinates,
  findLinkedInCoordinates,
} from "./extractor.js";
import axios from "axios";

async function createCoverPatch(pdfData, outputPath, options = {}) {
  try {
    const pdfDoc = await pdf.PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();
    const extractedText = await extractTextFromPDF(pdfData);

    const emailCoords = findEmailCoordinates(extractedText);
    const phoneCoords = findPhoneCoordinates(extractedText);
    const linkedInCoords = await findLinkedInCoordinates(
      pdfData,
      extractedText,
    );

    pages.forEach((page, pageArrayIndex) => {
      const pageIndex = pageArrayIndex + 1;
      const emailCoordsForPage = emailCoords.filter(
        (coord) => coord.page === pageIndex,
      );
      const phoneCoordsForPage = phoneCoords.filter(
        (coord) => coord.page === pageIndex,
      );
      const linkedInCoordsForPage = linkedInCoords.filter(
        (coord) => coord.page === pageIndex,
      );

      const mergedCoordinates = mergeCoordinatesForPage([
        ...emailCoordsForPage,
        ...phoneCoordsForPage,
        ...linkedInCoordsForPage,
      ]);

      applyPatches(page, mergedCoordinates, options);
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`Cover patch created successfully in ${outputPath}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

function applyPatches(page, coordinates, options = {}) {
  const maskStyle = options.maskStyle || "sharded";

  for (const coords of coordinates) {
    if (maskStyle === "solid") {
      page.drawRectangle({
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
        color: pdf.rgb(0, 0, 0),
      });
      continue;
    }

    drawShardedPatch(page, coords);
  }
}

function drawShardedPatch(page, coords) {
  page.drawRectangle({
    x: coords.x,
    y: coords.y,
    width: coords.width,
    height: coords.height,
    color: pdf.rgb(0.12, 0.12, 0.12),
  });

  const shardWidth = 3;
  const shardGap = 3;
  let column = 0;

  for (
    let x = coords.x;
    x < coords.x + coords.width;
    x += shardWidth + shardGap
  ) {
    const drawFromBottom = column % 2 === 0;
    const shardHeight = drawFromBottom
      ? coords.height * 0.7
      : coords.height * 0.62;
    const shardY = drawFromBottom
      ? coords.y
      : coords.y + coords.height - shardHeight;

    page.drawRectangle({
      x,
      y: shardY,
      width: Math.min(shardWidth, coords.x + coords.width - x),
      height: shardHeight,
      color: pdf.rgb(0, 0, 0),
    });

    column += 1;
  }
}

function mergeCoordinatesForPage(coordinates) {
  const expandedCoordinates = coordinates
    .filter(Boolean)
    .map((coord) => {
      const paddingX = Math.max(1.5, coord.height * 0.15);
      const paddingY = Math.max(1.2, coord.height * 0.12);
      return {
        ...coord,
        x: coord.x - paddingX,
        y: coord.y - paddingY,
        width: coord.width + paddingX * 2,
        height: coord.height + paddingY * 2,
      };
    })
    .sort((a, b) => a.x - b.x);

  const merged = [];

  for (const rect of expandedCoordinates) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...rect });
      continue;
    }

    const intersectsX = rect.x <= previous.x + previous.width;
    const intersectsY =
      rect.y <= previous.y + previous.height &&
      previous.y <= rect.y + rect.height;

    if (!intersectsX || !intersectsY) {
      merged.push({ ...rect });
      continue;
    }

    const newX = Math.min(previous.x, rect.x);
    const newY = Math.min(previous.y, rect.y);
    const newRight = Math.max(previous.x + previous.width, rect.x + rect.width);
    const newTop = Math.max(previous.y + previous.height, rect.y + rect.height);

    previous.x = newX;
    previous.y = newY;
    previous.width = newRight - newX;
    previous.height = newTop - newY;
  }

  return merged;
}

function parseCliArgs(argv) {
  const args = {
    input: null,
    url: null,
    output: path.resolve(process.cwd(), "output_patched.pdf"),
    maskStyle: "sharded",
  };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--input" && value) {
      args.input = value;
      i += 1;
      continue;
    }

    if (key === "--url" && value) {
      args.url = value;
      i += 1;
      continue;
    }

    if (key === "--output" && value) {
      args.output = value;
      i += 1;
      continue;
    }

    if (key === "--style" && value) {
      if (value === "solid" || value === "sharded") {
        args.maskStyle = value;
      }
      i += 1;
    }
  }

  return args;
}

async function loadPdfData({ input, url }) {
  if (input) {
    return fs.readFileSync(input);
  }

  if (url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return response.data;
  }

  throw new Error("Provide --input <file-path> or --url <pdf-url>.");
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const pdfData = await loadPdfData(args);
    await createCoverPatch(pdfData, args.output, {
      maskStyle: args.maskStyle,
    });
  } catch (error) {
    console.error("Failed to patch PDF:", error.message);
  }
}

main();
