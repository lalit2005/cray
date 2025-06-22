import React, { useState, useRef, useEffect } from "react";
import { Search, AlertCircle, CheckCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/Popover";
import { Button } from "../ui/Button";
import { LLMProvider } from "./types";
import { Providers, SUPPORTED_MODELS } from "~/lib/models";
import { getApiKey } from "~/lib/apiKeys";

interface ModelSearchProps {
  currentProvider: LLMProvider;
  currentModel: string;
  onSelect: (provider: LLMProvider, model: string) => void;
}

interface ModelOption {
  provider: LLMProvider;
  model: string;
  displayName: string;
  hasApiKey: boolean;
}

export const ModelSearch: React.FC<ModelSearchProps> = ({
  currentProvider,
  currentModel,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Keyboard shortcut: Cmd+M (Mac) or Ctrl+M (others) to open the dropdown
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof window !== "undefined" && navigator.userAgent.includes("Mac");
      if (
        ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) &&
        (e.key === "m" || e.key === "M")
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Generate all model options
  const allOptions: ModelOption[] = Object.entries(SUPPORTED_MODELS).flatMap(
    ([provider, models]) => {
      return models.map((model) => {
        const displayName =
          model.split("/").pop()?.split(":")[0].split("-").join(" ") || model;
        const hasApiKey = !!getApiKey(provider as Providers);

        return {
          provider: provider as LLMProvider,
          model,
          displayName,
          hasApiKey,
        };
      });
    }
  );

  // Filter options based on search query and sort by API key presence
  const filteredOptions = searchQuery
    ? allOptions
        .filter(
          (option) =>
            option.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
            option.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
            option.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
          // Sort by API key presence (models with keys first)
          if (a.hasApiKey && !b.hasApiKey) return -1;
          if (!a.hasApiKey && b.hasApiKey) return 1;
          return 0;
        })
    : allOptions.sort((a, b) => {
        // Sort by API key presence (models with keys first)
        if (a.hasApiKey && !b.hasApiKey) return -1;
        if (!a.hasApiKey && b.hasApiKey) return 1;
        return 0;
      });

  // Reset selection when filtered options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[selectedIndex]) {
          handleSelect(
            filteredOptions[selectedIndex].provider,
            filteredOptions[selectedIndex].model
          );
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Ensure selected item is visible in scroll view
  useEffect(() => {
    if (optionRefs.current[selectedIndex]) {
      optionRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Handle selection of model
  const handleSelect = (provider: LLMProvider, model: string) => {
    onSelect(provider, model);
    setIsOpen(false);
    setSearchQuery("");
  };

  const currentDisplayName =
    currentModel.split("/").pop()?.split(":")[0].split("-").join(" ") ||
    currentModel;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-medium">{currentProvider}</span>
            <span className="text-zinc-400 font-mono">/</span>
            <span>{currentDisplayName}</span>
          </span>
          {!getApiKey(currentProvider as Providers) && (
            <AlertCircle size={14} className="text-amber-500 block -mb-1" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[350px] max-h-[400px] flex flex-col translucent rounded-md shadow-lg"
        sideOffset={8}
      >
        <div className="p-2 border border-zinc-900 sticky top-0 translucent z-10 rounded-t-lg">
          <div className="relative flex items-center justify-stretch">
            <Search className="h-4 w-4 text-zinc-500 -mb-1" />
            <input
              ref={searchInputRef}
              className="w-full translucent rounded"
              placeholder={
                "Search models (" +
                (typeof window !== "undefined" &&
                navigator.userAgent.includes("Mac")
                  ? "CMD + M"
                  : "Ctrl + M") +
                ")..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[340px] rounded-b-md w-full">
          {filteredOptions.map((option, index) => (
            <button
              key={`${option.provider}-${option.model}`}
              ref={(el) => (optionRefs.current[index] = el)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer w-full ${
                selectedIndex === index ? "bg-zinc-800" : ""
              } hover:bg-zinc-800`}
              onClick={() => handleSelect(option.provider, option.model)}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{option.provider}</span>
                  <span className="text-xs text-zinc-500">/</span>
                  <span className="text-sm font-mono text-left">
                    {option.displayName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentProvider === option.provider &&
                  currentModel === option.model && (
                    <CheckCircle className="h-4 w-4 text-green-500 block" />
                  )}
                {!option.hasApiKey && (
                  <AlertCircle size={14} className="text-amber-500 block" />
                )}
              </div>
            </button>
          ))}

          {filteredOptions.length === 0 && (
            <div className="p-3 text-center text-zinc-500 text-sm">
              No models found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
