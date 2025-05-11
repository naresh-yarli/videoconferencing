// utils/clipboard.ts

/**
 * Copy text to clipboard
 * Uses modern Navigator.clipboard API with fallback to older document.execCommand
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    // Try to use the newer Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback to the older execCommand approach
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");

    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error("Failed to copy text using execCommand");
    }
  } catch (error) {
    console.error("Failed to copy text to clipboard", error);
    throw error;
  }
};
