// components/ChatInput.tsx
import React, { useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useRoom } from "@/contexts/RoomContext";
import { RootState } from "@/types";

const BotMessageRegex = new RegExp("^@bot (.*)");

const ChatInput: React.FC = () => {
  const { roomClient } = useRoom();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get connected state and data producers from Redux
  const connected = useSelector(
    (state: RootState) => state.room.state === "connected"
  );
  const dataProducers = useSelector((state: RootState) => state.dataProducers);

  // Find chat and bot data producers
  const dataProducersArray = Object.values(dataProducers);
  const chatDataProducer = dataProducersArray.find((dp) => dp.label === "chat");
  const botDataProducer = dataProducersArray.find((dp) => dp.label === "bot");

  // Determine if chat is disabled
  const disabled = !connected || (!chatDataProducer && !botDataProducer);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Shift+Enter or Ctrl+Enter, do nothing (allow multiline)
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey) {
      return;
    }

    // Prevent the Enter from being added to the textarea
    event.preventDefault();

    let message = text.trim();

    if (!message) {
      return;
    }

    setText("");

    if (!roomClient) {
      return;
    }

    const match = BotMessageRegex.exec(message);

    // Regular chat message
    if (!match) {
      roomClient.sendChatMessage(message);
    }
    // Message to the bot
    else {
      const botMessage = match[1].trim();
      roomClient.sendBotMessage(botMessage);
    }
  };

  return (
    <div className="ChatInput">
      <textarea
        ref={textareaRef}
        placeholder={disabled ? "Chat unavailable" : "Write here..."}
        dir="auto"
        autoComplete="off"
        disabled={disabled}
        value={text}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};

export default ChatInput;
