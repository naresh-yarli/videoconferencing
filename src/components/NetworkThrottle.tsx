// components/NetworkThrottle.tsx
import React, { useState, useEffect } from "react";
import { useRoom } from "@/contexts/RoomContext";
import Draggable from "react-draggable";

interface NetworkThrottleProps {
  secret: string;
}

const NetworkThrottle: React.FC<NetworkThrottleProps> = ({ secret }) => {
  const { roomClient } = useRoom();

  const [uplink, setUplink] = useState("");
  const [downlink, setDownlink] = useState("");
  const [rtt, setRtt] = useState("");
  const [packetLoss, setPacketLoss] = useState("");
  const [disabled, setDisabled] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (roomClient) {
        roomClient.resetNetworkThrottle({ silent: true });
      }
    };
  }, [roomClient]);

  // Apply network throttling
  const handleApply = async () => {
    if (!roomClient || disabled) return;

    setDisabled(true);

    try {
      await roomClient.applyNetworkThrottle({
        secret,
        uplink: Number(uplink) || 0,
        downlink: Number(downlink) || 0,
        rtt: Number(rtt) || 0,
        packetLoss: Number(packetLoss) || 0,
      });

      // Set up cleanup when window closes
      window.onunload = () => {
        roomClient.resetNetworkThrottle({ silent: true, secret });
      };
    } catch (error) {
      console.error("Failed to apply network throttle", error);
    } finally {
      setDisabled(false);
    }
  };

  // Reset network throttling
  const handleReset = async () => {
    if (!roomClient || disabled) return;

    setDisabled(true);

    try {
      // Reset values
      setUplink("");
      setDownlink("");
      setRtt("");
      setPacketLoss("");

      // Reset throttling
      await roomClient.resetNetworkThrottle({ secret });
    } catch (error) {
      console.error("Failed to reset network throttle", error);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Draggable
      bounds="parent"
      defaultPosition={{ x: 20, y: 20 }}
      handle="h1.draggable"
    >
      <form
        className="NetworkThrottle"
        onSubmit={(event) => {
          event.preventDefault();
          handleApply();
        }}
      >
        <h1 className="draggable">Network Throttle</h1>

        <div className="inputs">
          <div className="row">
            <p className="key">UPLINK (kbps)</p>

            <input
              className="value"
              type="text"
              placeholder="NO LIMIT"
              disabled={disabled}
              pattern="[0-9]*"
              value={uplink}
              autoCorrect="false"
              spellCheck="false"
              onChange={(event) => setUplink(event.target.value)}
            />
          </div>

          <div className="row">
            <p className="key">DOWNLINK (kbps)</p>

            <input
              className="value"
              type="text"
              placeholder="NO LIMIT"
              disabled={disabled}
              pattern="[0-9]*"
              value={downlink}
              autoCorrect="false"
              spellCheck="false"
              onChange={(event) => setDownlink(event.target.value)}
            />
          </div>

          <div className="row">
            <p className="key">RTT (ms)</p>

            <input
              className="value"
              type="text"
              placeholder="NOT SET"
              disabled={disabled}
              pattern="[0-9]*"
              value={rtt}
              autoCorrect="false"
              spellCheck="false"
              onChange={(event) => setRtt(event.target.value)}
            />
          </div>

          <div className="row">
            <p className="key">PACKETLOSS (%)</p>

            <input
              className="value"
              type="text"
              placeholder="NOT SET"
              disabled={disabled}
              pattern="[0-9]*"
              value={packetLoss}
              autoCorrect="false"
              spellCheck="false"
              onChange={(event) => setPacketLoss(event.target.value)}
            />
          </div>
        </div>

        <div className="buttons">
          <button
            type="button"
            className="reset"
            disabled={disabled}
            onClick={() => handleReset()}
          >
            RESET
          </button>

          <button
            type="submit"
            className="apply"
            disabled={
              disabled ||
              (!uplink.trim() &&
                !downlink.trim() &&
                !rtt.trim() &&
                !packetLoss.trim())
            }
          >
            APPLY
          </button>
        </div>
      </form>
    </Draggable>
  );
};

export default NetworkThrottle;
