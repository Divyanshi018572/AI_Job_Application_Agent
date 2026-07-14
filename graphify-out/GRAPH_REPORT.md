# Graph Report - .  (2026-07-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 712 nodes · 1404 edges · 45 communities (40 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ce3db5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createClient
- button.tsx
- dependencies
- item.tsx
- cn
- react
- scripts
- menubar.tsx
- compilerOptions
- utils.ts
- components.json
- command.tsx
- sidebar.tsx
- context-menu.tsx
- credits-display.tsx
- carousel.tsx
- app-sidebar.tsx
- alert-dialog.tsx
- attachment.tsx
- sheet.tsx
- auth-shell.tsx
- navigation-menu.tsx
- pagination.tsx
- table.tsx
- breadcrumb.tsx
- empty.tsx
- database.ts
- layout.tsx
- useSidebar
- avatar.tsx
- bubble.tsx
- message.tsx
- message-scroller.tsx
- popover.tsx
- toggle-group.tsx
- tabs.tsx
- marker.tsx
- open-browser.ps1
- dashboard-shell.tsx
- hover-card.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 341 edges
2. `createClient()` - 23 edges
3. `Button()` - 21 edges
4. `react` - 17 edges
5. `compilerOptions` - 16 edges
6. `enforceRateLimit()` - 13 edges
7. `scripts` - 13 edges
8. `mapAuthErrorMessage()` - 11 edges
9. `useSidebar()` - 9 edges
10. `getSupabaseUrl()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogMedia()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (45 total, 5 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.09
Nodes (39): GET(), POST(), POST(), POST(), POST(), POST(), POST(), POST() (+31 more)

### Community 1 - "button.tsx"
Cohesion: 0.08
Nodes (33): AuthShell(), GoogleSignInButton(), GoogleSignInButtonProps, Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants (+25 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (45): @base-ui/react, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, input-otp, lucide-react (+37 more)

### Community 3 - "item.tsx"
Cohesion: 0.08
Nodes (21): BlankPage(), BlankPageProps, DashboardHeader(), DashboardHeaderProps, ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants (+13 more)

### Community 4 - "cn"
Cohesion: 0.09
Nodes (33): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear() (+25 more)

### Community 5 - "react"
Cohesion: 0.06
Nodes (30): CalendarDayButton(), ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+22 more)

### Community 6 - "scripts"
Cohesion: 0.06
Nodes (35): cross-env, eslint, eslint-config-next, devDependencies, cross-env, eslint, eslint-config-next, tailwindcss (+27 more)

### Community 7 - "menubar.tsx"
Cohesion: 0.09
Nodes (26): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuPortal(), DropdownMenuRadioGroup() (+18 more)

### Community 8 - "compilerOptions"
Cohesion: 0.06
Nodes (30): ./*, dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts (+22 more)

### Community 9 - "utils.ts"
Cohesion: 0.09
Nodes (14): AspectRatio(), Badge(), badgeVariants, Checkbox(), Kbd(), KbdGroup(), NativeSelect(), NativeSelectOptGroup() (+6 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "command.tsx"
Cohesion: 0.12
Nodes (16): Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+8 more)

### Community 12 - "sidebar.tsx"
Cohesion: 0.13
Nodes (15): SidebarContext, SidebarContextProps, SidebarGroupAction(), SidebarInput(), SidebarMenuAction(), SidebarMenuBadge(), SidebarMenuSub(), SidebarMenuSubButton() (+7 more)

### Community 13 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubTrigger() (+1 more)

### Community 14 - "credits-display.tsx"
Cohesion: 0.19
Nodes (11): CreditsDisplay(), CreditsDisplayProps, Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue(), creditsPlaceholder (+3 more)

### Community 15 - "carousel.tsx"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 16 - "app-sidebar.tsx"
Cohesion: 0.17
Nodes (12): isActivePath(), navButtonClassName, NavItems(), SidebarContent(), SidebarFooter(), SidebarGroup(), SidebarGroupContent(), SidebarGroupLabel() (+4 more)

### Community 17 - "alert-dialog.tsx"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 18 - "attachment.tsx"
Cohesion: 0.20
Nodes (11): Attachment(), AttachmentAction(), AttachmentActions(), AttachmentContent(), AttachmentDescription(), AttachmentGroup(), AttachmentMedia(), attachmentMediaVariants (+3 more)

### Community 19 - "sheet.tsx"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 20 - "auth-shell.tsx"
Cohesion: 0.31
Nodes (8): AuthShellProps, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 21 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuPositioner(), NavigationMenuTrigger() (+1 more)

### Community 22 - "pagination.tsx"
Cohesion: 0.22
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 23 - "table.tsx"
Cohesion: 0.22
Nodes (8): Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead(), TableHeader(), TableRow()

### Community 24 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (7): Breadcrumb(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 25 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 26 - "database.ts"
Cohesion: 0.25
Nodes (7): Database, DatabaseWithoutInternals, DefaultSchema, Json, Tables, TablesInsert, TablesUpdate

### Community 27 - "layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, Toaster()

### Community 28 - "useSidebar"
Cohesion: 0.29
Nodes (7): SidebarLogo(), Sidebar(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarRail(), SidebarTrigger(), useSidebar()

### Community 29 - "avatar.tsx"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 30 - "bubble.tsx"
Cohesion: 0.38
Nodes (6): Bubble(), BubbleContent(), BubbleGroup(), BubbleReactions(), bubbleReactionsVariants, bubbleVariants

### Community 31 - "message.tsx"
Cohesion: 0.29
Nodes (6): Message(), MessageAvatar(), MessageContent(), MessageFooter(), MessageGroup(), MessageHeader()

### Community 32 - "message-scroller.tsx"
Cohesion: 0.29
Nodes (5): MessageScroller(), MessageScrollerButton(), MessageScrollerContent(), MessageScrollerItem(), MessageScrollerViewport()

### Community 33 - "popover.tsx"
Cohesion: 0.29
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 34 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 35 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 36 - "marker.tsx"
Cohesion: 0.50
Nodes (4): Marker(), MarkerContent(), MarkerIcon(), markerVariants

### Community 38 - "dashboard-shell.tsx"
Cohesion: 0.50
Nodes (3): AppSidebar(), DashboardShellProps, SidebarInset()

## Knowledge Gaps
- **135 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `$schema`, `style` (+130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `button.tsx`, `item.tsx`, `react`, `menubar.tsx`, `utils.ts`, `command.tsx`, `sidebar.tsx`, `context-menu.tsx`, `credits-display.tsx`, `carousel.tsx`, `app-sidebar.tsx`, `alert-dialog.tsx`, `attachment.tsx`, `sheet.tsx`, `auth-shell.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `table.tsx`, `breadcrumb.tsx`, `empty.tsx`, `useSidebar`, `avatar.tsx`, `bubble.tsx`, `message.tsx`, `message-scroller.tsx`, `popover.tsx`, `toggle-group.tsx`, `tabs.tsx`, `marker.tsx`, `dashboard-shell.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.593) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `react`, `scripts`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `toggle-group.tsx`, `dependencies`, `sidebar.tsx`, `carousel.tsx`, `useSidebar`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **What connects `geistSans`, `geistMono`, `metadata` to the rest of the system?**
  _135 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.09074410163339383 - nodes in this community are weakly interconnected._
- **Should `button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07985480943738657 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._