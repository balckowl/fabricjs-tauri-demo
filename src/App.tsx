import { Canvas, FabricImage, Shadow, util } from "fabric";
import { useEffect, useRef, useState } from "react";

export default function App() {
  // canvasElRef.current を canvas1（DOM要素）、canvasRef.current を canvas2（Fabric.Canvas）
  const canvasRef = useRef<Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<FabricImage | null>(null);
  // 画像の初期パラメータを保存
  const originalParamsRef = useRef({
    originalLeft: 0,
    originalTop: 0,
    originalScale: 1,
    targetWidth: 0,
    targetHeight: 0,
  });

  const [imageSrc] = useState("/demo.mp4");
  // シークバー＆自動再生用タイムライン (0～20秒)
  const [currentTime, setCurrentTime] = useState(0);

  // zoom効果の定義
  // 例:
  // ・[70,70] → 画像上の (70,70) をキャンバス中央に合わせる（translation＋zoom）
  // ・[400,250] → 画像上の (400,250) をキャンバス中央に合わせる
  // ・[60,50] → 画像上の (60,50) を中央に合わせる
  // ※ point が [0,0] の場合は、translation は行わず単に拡大する
  const zoomEffects = [
    { timing: 3, point: [400, 250] },
    { timing: 12, point: [0, 0] },
    { timing: 17, point: [0, 0] },
  ];

  const zoomFactor = 1.2; // 拡大率（例：20%拡大）
  const zoomDuration = 2; // 各段階のアニメーション時間（秒）
  const cycleDuration = 20; // 1サイクルの全体時間（秒）

  // ① キャンバス／背景画像のセットアップ（canvas1）
  useEffect(() => {
    async function setUpCanvas() {
      if (!canvasElRef.current) return;
      const canvas = new Canvas(canvasElRef.current, {
        width: 800,
        height: 500,
        backgroundColor: "#ffffff",
      });
      canvas.isDrawingMode = false;
      canvasRef.current = canvas;

      const bgImg = await FabricImage.fromURL("/mac.jpg");
      bgImg.scaleToWidth(800);
      bgImg.scaleToHeight(500);
      bgImg.set({
        selectable: false,
        evented: false,
        erasable: false,
      });
      canvas.set("backgroundImage", bgImg);
      canvas.renderAll();
    }
    setUpCanvas();
  }, []);

  // ② demo.mp4（FabricImage）の読み込みと初期配置（canvas2）
  useEffect(() => {
    async function setUpImage() {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const img = await FabricImage.fromURL(imageSrc);
      const targetWidth = 700;
      img.scaleToWidth(targetWidth);
      const targetHeight = img.getScaledHeight();

      // 初期配置：canvas2 上でキャンバス中央に配置（origin は "left"/"top"）
      const originalLeft = (canvas.width - targetWidth) / 2;
      const originalTop = (canvas.height - targetHeight) / 2;
      img.set({
        left: originalLeft,
        top: originalTop,
        originX: "left",
        originY: "top",
        shadow: new Shadow({
          color: "rgba(0,0,0,0.3)",
          blur: 20,
          offsetX: 15,
          offsetY: 15,
        }),
      });
      canvas.add(img);
      canvas.renderAll();

      imageRef.current = img;
      originalParamsRef.current = {
        originalLeft,
        originalTop,
        originalScale: img.scaleX,
        targetWidth,
        targetHeight,
      };

      // 画像の読み込み完了後、1サイクルのアニメーションをスケジュール
      scheduleCycle();
    }
    setUpImage();
  }, [imageSrc]);

  // ③ 1サイクル（20秒）のアニメーションをチェーンでスケジュールする関数
  const timersRef = useRef<number[]>([]);
  const scheduleCycle = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const { originalLeft, originalTop, originalScale } = originalParamsRef.current;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };

    // 既存のタイマーをクリア
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    zoomEffects.forEach((effect) => {
      const T = effect.timing;
      const [px, py] = effect.point;
      const targetScale = originalScale * zoomFactor;
      let targetLeft: number, targetTop: number;
      if (px === 0 && py === 0) {
        // point が [0,0] の場合は translation は行わず、
        // canvas2 の中心（＝canvas1 の中心＝初期配置）を基準として scale のみ変更
        targetLeft = originalLeft;
        targetTop = originalTop;
      } else {
        // 画像上の (px,py) を canvas1 の中心に合わせる位置を計算
        targetLeft = center.x - px * targetScale;
        targetTop = center.y - py * targetScale;
      }

      // Zoom In：チェーンアニメーション
      // Phase 1: Translation（位置移動）
      timersRef.current.push(
        window.setTimeout(() => {
          img.animate(
            { left: targetLeft, top: targetTop },
            {
              duration: (zoomDuration / 2) * 1000,
              easing: util.ease.easeInOutQuad,
              onChange: () => canvas.renderAll(),
              onComplete: () => {
                // Phase 2: Scaling（拡大）
                img.animate(
                  { scaleX: targetScale, scaleY: targetScale },
                  {
                    duration: (zoomDuration / 2) * 1000,
                    easing: util.ease.easeInOutQuad,
                    onChange: () => canvas.renderAll(),
                  }
                );
              },
            }
          );
        }, (T - 3) * 1000)
      );

      // Zoom Out：チェーンアニメーション
      // Phase 1: Scaling back（拡大率を元に戻す）
      timersRef.current.push(
        window.setTimeout(() => {
          img.animate(
            { scaleX: originalScale, scaleY: originalScale },
            {
              duration: (zoomDuration / 2) * 1000,
              easing: util.ease.easeInOutQuad,
              onChange: () => canvas.renderAll(),
              onComplete: () => {
                // Phase 2: Translation back（位置を元に戻す）
                img.animate(
                  { left: originalLeft, top: originalTop },
                  {
                    duration: (zoomDuration / 2) * 1000,
                    easing: util.ease.easeInOutQuad,
                    onChange: () => canvas.renderAll(),
                  }
                );
              },
            }
          );
        }, T * 1000)
      );
    });

    // サイクル終了（20秒後）にリセットして再スケジュール
    timersRef.current.push(
      window.setTimeout(() => {
        img.set({
          left: originalLeft,
          top: originalTop,
          scaleX: originalScale,
          scaleY: originalScale,
        });
        canvas.renderAll();
        scheduleCycle();
      }, cycleDuration * 1000)
    );
  };

  // ④ シークバー用：currentTime を自動更新（20秒ループ）
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.05;
        return next >= cycleDuration ? 0 : next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden mt-4">
      <canvas ref={canvasElRef} id="canvas" />
      <div style={{ marginTop: 10 }}>
        <input
          type="range"
          min="0"
          max={cycleDuration}
          step="0.01"
          value={currentTime}
          onChange={(e) => setCurrentTime(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div>Time: {currentTime.toFixed(2)} sec</div>
      </div>
    </div>
  );
}
