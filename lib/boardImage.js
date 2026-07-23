const CATEGORY_COLORS = {
  1: { fill: "#eff6ff", border: "#93c5fd" },
  2: { fill: "#f0fdf4", border: "#86efac" },
  3: { fill: "#fff7ed", border: "#fdba74" },
};

function drawWrappedText(context, text, x, y, width, lineHeight) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  lines.slice(0, 4).forEach((value, index) => {
    context.fillText(value, x, y + index * lineHeight);
  });
}

/** 사진 없이도 공유 가능한 빙고 현황 이미지를 내려받습니다. */
export async function downloadBoardImage({ cells, filled, lines }) {
  const canvas = document.createElement("canvas");
  const size = 1200;
  const padding = 48;
  const gap = 14;
  const headerHeight = 170;
  const gridSize = size - padding * 2;
  const cellSize = (gridSize - gap * 3) / 4;
  canvas.width = size;
  canvas.height = headerHeight + gridSize + padding;

  const context = canvas.getContext("2d");
  context.fillStyle = "#faf9f7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e11d48";
  context.font = "800 48px Pretendard, sans-serif";
  context.fillText("러닝크루 빙고", padding, 68);
  context.fillStyle = "#475569";
  context.font = "600 28px Pretendard, sans-serif";
  context.fillText(`완성 칸 ${filled}/16 · 빙고 ${lines}줄`, padding, 118);

  for (const cell of cells) {
    const row = Math.floor(cell.position / 4);
    const column = cell.position % 4;
    const x = padding + column * (cellSize + gap);
    const y = headerHeight + row * (cellSize + gap);
    const colors = CATEGORY_COLORS[cell.category] || CATEGORY_COLORS[1];

    context.fillStyle = colors.fill;
    context.strokeStyle = cell.photoUrl ? "#e11d48" : colors.border;
    context.lineWidth = cell.photoUrl ? 8 : 4;
    context.beginPath();
    context.roundRect(x, y, cellSize, cellSize, 22);
    context.fill();
    context.stroke();

    if (cell.photoUrl) {
      context.fillStyle = "#e11d48";
      context.beginPath();
      context.arc(x + cellSize - 36, y + 36, 24, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = "800 30px sans-serif";
      context.textAlign = "center";
      context.fillText("✓", x + cellSize - 36, y + 47);
    }

    context.fillStyle = "#1e293b";
    context.font = "700 24px Pretendard, sans-serif";
    context.textAlign = "center";
    drawWrappedText(context, cell.content, x + cellSize / 2, y + cellSize / 2 - 24, cellSize - 28, 31);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("빙고판 이미지 생성에 실패했습니다.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "running-crew-bingo.png";
  link.click();
  URL.revokeObjectURL(url);
}
