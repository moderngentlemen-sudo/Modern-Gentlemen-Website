"use client";

import { Component, type ReactNode } from "react";

/**
 * Contains a single block's render failure.
 *
 * This is not defensive decoration. `normalizeBlock` is deliberately forgiving:
 * when a block's props fail their own schema it returns the *raw* props rather
 * than refusing to render, because the renderer must not be what decides a page
 * is unrenderable. The consequence in an editor is that an author who empties a
 * required list sends `items === undefined` into `LatestGrid`, whose
 * `items.map()` throws — and without a boundary that one mistake blanks the
 * entire builder, including the panel needed to undo it.
 *
 * A class component because React exposes no hook equivalent of
 * `componentDidCatch`.
 */
interface Props {
  type: string;
  onSelect?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Editing the block is the fix; clear the error so it can render again.
    if (prev.children !== this.props.children && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="border border-mg-accentSerif/40 bg-mg-accent/5 px-6 py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mg-accentSerif">
          {this.props.type}
        </p>
        <p className="mt-2 text-[13px] text-mg-fg/70">
          This block could not be rendered with its current settings.
        </p>
        <p className="mt-1 font-mono text-[11px] text-mg-fg/60">{this.state.error.message}</p>
        {this.props.onSelect && (
          <button
            type="button"
            onClick={this.props.onSelect}
            className="mt-4 border border-mg-bd/30 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] hover:border-mg-fg"
          >
            Edit its settings
          </button>
        )}
      </div>
    );
  }
}
