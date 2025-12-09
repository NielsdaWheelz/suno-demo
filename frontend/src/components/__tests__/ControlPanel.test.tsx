import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ControlPanel, type ControlPanelProps } from "../ControlPanel";

const makeProps = (overrides: Partial<ControlPanelProps> = {}): ControlPanelProps => ({
  brief: "lofi beats",
  params: { energy: 0.3, density: 0.4, duration_sec: 6 },
  canGenerate: true,
  loading: false,
  errorMessage: undefined,
  onBriefChange: vi.fn(),
  onParamsChange: vi.fn(),
  onGenerate: vi.fn(),
  ...overrides,
});

describe("ControlPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders inputs with initial values", () => {
    const props = makeProps();
    render(<ControlPanel {...props} />);

    expect(screen.getByLabelText(/description/i)).toHaveValue("lofi beats");
    expect(screen.getByLabelText(/energy/i)).toHaveValue("0.3");
    expect(screen.getByLabelText(/density/i)).toHaveValue("0.4");
    expect(screen.getByLabelText(/duration/i)).toHaveValue("6");
  });

  it("calls onBriefChange when brief is edited", () => {
    const props = makeProps({ onBriefChange: vi.fn() });
    render(<ControlPanel {...props} />);

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "new brief" },
    });

    expect(props.onBriefChange).toHaveBeenCalledTimes(1);
    expect(props.onBriefChange).toHaveBeenCalledWith("new brief");
  });

  it("disables generate button when loading or cannot generate", () => {
    const { rerender } = render(<ControlPanel {...makeProps({ loading: true })} />);

    const button = screen.getByRole("button", { name: /generating/i });
    expect(button).toBeDisabled();

    rerender(<ControlPanel {...makeProps({ canGenerate: false })} />);
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("calls onGenerate once when enabled and clicked", () => {
    const onGenerate = vi.fn();
    render(<ControlPanel {...makeProps({ onGenerate })} />);

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
