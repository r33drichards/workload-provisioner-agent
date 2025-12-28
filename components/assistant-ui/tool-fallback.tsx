import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { useState, memo, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// Truncate long strings for performance
const truncateString = (str: string, maxLength: number = 1000): { text: string; isTruncated: boolean } => {
  if (str.length <= maxLength) {
    return { text: str, isTruncated: false };
  }
  return {
    text: str.slice(0, maxLength) + "...",
    isTruncated: true
  };
};

// Format elapsed time in milliseconds to a readable string
const formatElapsedTime = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
};

// Standalone props interface for use outside assistant-ui
interface ToolFallbackStandaloneProps {
  toolName: string;
  argsText: string;
  result?: unknown;
}

// Internal component that handles the rendering logic
const ToolFallbackUI = ({
  toolName,
  argsText,
  result,
}: {
  toolName: string;
  argsText: string;
  result?: unknown;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showFullArgs, setShowFullArgs] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);
  const isComplete = result !== undefined;

  // Track elapsed time
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  useEffect(() => {
    if (isComplete && elapsedTime === null) {
      // Calculate elapsed time when result becomes available
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(elapsed);
    }
  }, [isComplete, elapsedTime]);

  // Memoize formatted result to avoid re-stringifying on every render
  const formattedResult = useMemo(() => {
    if (result === undefined) return null;
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  }, [result]);

  // Truncate args and result for better performance
  const truncatedArgs = useMemo(() => truncateString(argsText, 1000), [argsText]);
  const truncatedResult = useMemo(() => {
    if (!formattedResult) return { text: "", isTruncated: false };
    return truncateString(formattedResult, 1000);
  }, [formattedResult]);

  return (
    <div className="aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3">
      <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
        {isComplete ? (
          <CheckIcon className="aui-tool-fallback-icon size-4" />
        ) : (
          <Loader2Icon className="aui-tool-fallback-icon size-4 animate-spin" />
        )}
        <p className="aui-tool-fallback-title flex-grow">
          {isComplete ? "Used" : "Using"} tool: <b>{toolName}</b>
          {elapsedTime !== null && (
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({formatElapsedTime(elapsedTime)})
            </span>
          )}
        </p>
        <Button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
          <div className="aui-tool-fallback-args-root px-4">
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap max-h-96 overflow-y-auto">
              {showFullArgs ? argsText : truncatedArgs.text}
            </pre>
            {truncatedArgs.isTruncated && (
              <button
                onClick={() => setShowFullArgs(!showFullArgs)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showFullArgs ? "Show less" : "Show more..."}
              </button>
            )}
          </div>
          {result !== undefined && (
            <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
              <p className="aui-tool-fallback-result-header font-semibold">
                Result:
              </p>
              <pre className="aui-tool-fallback-result-content whitespace-pre-wrap max-h-96 overflow-y-auto">
                {showFullResult ? formattedResult : truncatedResult.text}
              </pre>
              {truncatedResult.isTruncated && (
                <button
                  onClick={() => setShowFullResult(!showFullResult)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {showFullResult ? "Show less" : "Show more..."}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Component for use with assistant-ui framework
const ToolFallbackComponent: ToolCallMessagePartComponent = (props) => {
  return <ToolFallbackUI toolName={props.toolName} argsText={props.argsText} result={props.result} />;
};

ToolFallbackComponent.displayName = "ToolFallback";

// Export for use with assistant-ui framework
export const ToolFallback = memo(ToolFallbackComponent);

// Export standalone version for use outside assistant-ui
export const ToolFallbackStandalone = memo<ToolFallbackStandaloneProps>(ToolFallbackUI);
