import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import floorplan1f from "@/assets/floorplan-1f.png";
import floorplan2f from "@/assets/floorplan-2f.png";
import floorplan3f from "@/assets/floorplan-3f.png";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const floors = [
  { label: "1층", src: floorplan1f },
  { label: "2층", src: floorplan2f },
  { label: "3층", src: floorplan3f },
];

const rooms = [
  "거실", "주방 & 식당", "부엌",
  "계단", "부부 침실", "자녀방", "드레스룸",
  "오피스", "짐 보관방",
];

interface RoomRect {
  room: string;
  floor: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const FloorplanTool = () => {
  useDocumentTitle("도면 좌표 도구 | 관리자 | 하우스인어스");
  const [rects, setRects] = useState<RoomRect[]>([]);
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [drawingFloor, setDrawingFloor] = useState<number | null>(null);

  const getRelativePos = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
    };
  };

  const handleMouseDown = (floorIdx: number, e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    setDrawing(true);
    setStartPos(pos);
    setCurrentPos(pos);
    setDrawingFloor(floorIdx);
  };

  const handleMouseMove = (floorIdx: number, e: React.MouseEvent<HTMLImageElement>) => {
    if (!drawing || drawingFloor !== floorIdx) return;
    setCurrentPos(getRelativePos(e));
  };

  const handleMouseUp = (floorIdx: number) => {
    if (!drawing || !startPos || !currentPos || drawingFloor !== floorIdx) {
      setDrawing(false);
      return;
    }

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w > 2 && h > 2) {
      setRects((prev) => {
        const filtered = prev.filter((r) => r.room !== selectedRoom);
        return [...filtered, { room: selectedRoom, floor: floorIdx + 1, x, y, w, h }];
      });
    }

    setDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
    setDrawingFloor(null);
  };

  const getDrawingRect = () => {
    if (!startPos || !currentPos) return null;
    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      w: Math.abs(currentPos.x - startPos.x),
      h: Math.abs(currentPos.y - startPos.y),
    };
  };

  const output = rooms.map((room) => {
    const r = rects.find((rect) => rect.room === room);
    return r
      ? `  { room: "${room}", floorplanRect: [${r.x}, ${r.y}, ${r.w}, ${r.h}] }`
      : `  // ${room}: 미지정`;
  }).join(",\n");

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 select-none">
      <div className="mb-6 pb-4 border-b">
        <div className="flex items-center gap-4 mb-2">
          <Link to="/" className="text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">🛠️ House In Us Admin - 평면도 영역 맵핑</h1>
        </div>
        <p className="text-gray-600 text-sm ml-9">
          새로운 매물이 등록될 때 이미지 갤러리와 평면도를 동기화하기 위한 사내 관리자 도구입니다.<br/>
          방을 선택한 뒤 평면도에서 <strong>드래그</strong>하여 영역 좌표를 추출하고 <code className="bg-gray-100 px-1 rounded">properties.ts</code>에 반영하세요.
        </p>
      </div>

      {/* Room selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {rooms.map((room) => {
          const hasRect = rects.some((r) => r.room === room);
          return (
            <button
              key={room}
              onClick={() => setSelectedRoom(room)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                selectedRoom === room
                  ? "bg-blue-600 text-white border-blue-600"
                  : hasRect
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-gray-100 text-gray-700 border-gray-300"
              }`}
            >
              {room} {hasRect ? "✓" : ""}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-blue-600 mb-4 font-medium">
        현재 선택: <strong>{selectedRoom}</strong> — 평면도에서 드래그하세요
      </p>

      {/* Floorplans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {floors.map((floor, idx) => (
          <div key={idx} className="border rounded-lg p-2">
            <h3 className="font-semibold text-center mb-2">{floor.label}</h3>
            <div className="relative">
              <img
                src={floor.src}
                alt={floor.label}
                className="w-full cursor-crosshair"
                draggable={false}
                onMouseDown={(e) => handleMouseDown(idx, e)}
                onMouseMove={(e) => handleMouseMove(idx, e)}
                onMouseUp={() => handleMouseUp(idx)}
                onMouseLeave={() => { if (drawingFloor === idx) handleMouseUp(idx); }}
              />
              {/* Existing rects */}
              {rects
                .filter((r) => r.floor === idx + 1)
                .map((r) => (
                  <div
                    key={r.room}
                    className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                    style={{
                      left: `${r.x}%`,
                      top: `${r.y}%`,
                      width: `${r.w}%`,
                      height: `${r.h}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] bg-blue-600 text-white px-1 rounded whitespace-nowrap">
                      {r.room}
                    </span>
                  </div>
                ))}
              {/* Drawing preview */}
              {drawing && drawingFloor === idx && getDrawingRect() && (
                <div
                  className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
                  style={{
                    left: `${getDrawingRect()!.x}%`,
                    top: `${getDrawingRect()!.y}%`,
                    width: `${getDrawingRect()!.w}%`,
                    height: `${getDrawingRect()!.h}%`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Output */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs md:text-sm overflow-x-auto select-text">
        <p className="text-gray-400 mb-2 select-text">// floorplanRect: [x%, y%, width%, height%]</p>
        <pre className="select-text">{`[\n${output}\n]`}</pre>
      </div>
    </div>
  );
};

export default FloorplanTool;
