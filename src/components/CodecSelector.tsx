// src/components/CodecSelector.tsx
import React, { useState, useEffect } from "react";
import { useRoom } from "@/contexts/RoomContext";

export const CodecSelector: React.FC = () => {
  const { roomClient } = useRoom();
  const [selectedCodec, setSelectedCodec] = useState<string>("auto");
  const [capabilities, setCapabilities] = useState({
    vp8: false,
    h264: false,
    vp9: false,
    av1: false,
  });

  useEffect(() => {
    if (roomClient) {
      const caps = roomClient.getCodecCapabilities();
      setCapabilities(caps);
    }
  }, [roomClient]);

  const handleCodecChange = (codec: string) => {
    setSelectedCodec(codec);

    if (roomClient && codec !== "auto") {
      roomClient.setPreferredCodec(codec as "vp8" | "h264" | "vp9" | "av1");
    }
  };

  return (
    <div className="codec-selector">
      <label>Video Codec:</label>
      <select
        value={selectedCodec}
        onChange={(e) => handleCodecChange(e.target.value)}
      >
        <option value="auto">Auto</option>
        {capabilities.vp8 && <option value="vp8">VP8</option>}
        {capabilities.h264 && <option value="h264">H.264</option>}
        {capabilities.vp9 && <option value="vp9">VP9</option>}
        {capabilities.av1 && <option value="av1">AV1</option>}
      </select>
    </div>
  );
};
