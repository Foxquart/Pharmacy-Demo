/**
 * UI primitives. Everything here is token-only — no raw palette colours, so every
 * component is correct in light and dark by construction rather than by review.
 *
 * Conventions shared across the library:
 *  - One radius system: `--radius-sm | --radius | --radius-md | --radius-lg | --radius-xl`.
 *  - Motion budget 120–200ms on `transform` / `opacity` / colour only, on
 *    `--ease-out-quart`. Transitions always name their properties.
 *  - Numbers use the global `.numeric` class (mono face + tabular figures).
 *  - Focus comes from the global `:focus-visible` rule and is never overridden.
 */

export { Alert } from "./alert";
export type { AlertProps, AlertTone } from "./alert";

export { Badge } from "./badge";
export type { BadgeProps, BadgeSize, BadgeTone } from "./badge";

export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
export type { CardProps } from "./card";

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
export type { DialogContentProps, DialogSize } from "./dialog";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export type { DropdownMenuItemProps } from "./dropdown-menu";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps, EmptyStateSize } from "./empty-state";

export { controlClassName, Field, Input, InputGroup, NumberInput } from "./input";
export type {
  FieldProps,
  InputGroupProps,
  InputProps,
  InputSize,
  NumberInputProps,
} from "./input";

export { Kbd, KbdGroup } from "./kbd";
export type { KbdGroupProps, KbdProps, KbdSize } from "./kbd";

export { Segmented } from "./segmented";
export type { SegmentedOption, SegmentedProps, SegmentedSize } from "./segmented";

export {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
export type { SelectFieldProps, SelectTriggerProps } from "./select";

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
export type { SheetContentProps, SheetSide } from "./sheet";

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonText } from "./skeleton";
export type {
  SkeletonCardProps,
  SkeletonProps,
  SkeletonRowProps,
  SkeletonTextProps,
} from "./skeleton";

export { Stat } from "./stat";
export type { StatDelta, StatDeltaDirection, StatDeltaTone, StatProps } from "./stat";

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
export type {
  TableCellProps,
  TableHeadProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "./table";

export { ThemeToggle } from "./theme-toggle";
export type { ThemeToggleProps } from "./theme-toggle";

export { Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
