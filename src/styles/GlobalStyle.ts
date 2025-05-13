import { createGlobalStyle } from "styled-components";
import { theme } from "../theme";

export const GlobalStyle = createGlobalStyle`
  html, body, #__next {
    height: 100%;
    min-height: 100%;
  }
  body {
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: ${theme.font.family};
    margin: 0;
    padding: 0;
    font-size: ${theme.font.size.base};
    transition: background 0.3s, color 0.3s;
    min-height: 100vh;
  }
  a {
    color: ${theme.colors.primary};
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  *:focus {
    outline: 2px solid ${theme.colors.accent};
    outline-offset: 2px;
  }
  button {
    font-family: inherit;
    font-size: inherit;
  }
`;
