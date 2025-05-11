// components/EditableInput.tsx
import React, { useState, useEffect, useRef } from "react";

interface EditableInputProps {
  value: string;
  propName: string;
  className?: string;
  classLoading?: string;
  classInvalid?: string;
  editProps?: any;
  onChange: (data: Record<string, string>) => void;
}

const EditableInput: React.FC<EditableInputProps> = ({
  value,
  propName,
  className = "",
  classLoading = "",
  classInvalid = "",
  editProps = {},
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal state when prop value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing && !isLoading) {
      setIsEditing(true);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(event.target.value);
    setIsInvalid(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsEditing(false);
      setEditValue(value);
    } else if (event.key === "Enter") {
      handleSubmit();
    }
  };

  const handleBlur = () => {
    handleSubmit();
  };

  const handleSubmit = () => {
    if (isLoading) return;

    // Don't submit if value hasn't changed
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    // Basic validation
    if (!editValue.trim()) {
      setIsInvalid(true);
      return;
    }

    setIsLoading(true);

    // Prepare data for onChange
    const data: Record<string, string> = {};
    data[propName] = editValue;

    try {
      // Call onChange callback
      onChange(data);

      // Exit edit mode
      setIsEditing(false);
      setIsLoading(false);
    } catch (error) {
      console.error("Error in EditableInput onChange handler:", error);
      setIsInvalid(true);
      setIsLoading(false);
    }
  };

  // Determine CSS classes
  const computedClassName = [
    className,
    isEditing ? "editing" : "",
    isLoading ? classLoading : "",
    isInvalid ? classInvalid : "",
  ]
    .filter(Boolean)
    .join(" ");

  return isEditing ? (
    <input
      ref={inputRef}
      className={computedClassName}
      value={editValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isLoading}
      {...editProps}
    />
  ) : (
    <span className={computedClassName} onClick={handleClick}>
      {value || <i className="empty">(empty)</i>}
    </span>
  );
};

export default React.memo(EditableInput);
