import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Button } from "./button";

test("renders button with correct text", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText("Click me")).toBeDefined();
});

test("renders button with correct variant", () => {
  render(<Button variant="destructive">Delete</Button>);
  const button = screen.getByRole("button", { name: /delete/i });
  expect(button.className).toContain("bg-destructive");
});
