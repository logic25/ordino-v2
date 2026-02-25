

# Fix Chat Sidebar: Vibrant Styling + Features Not Rendering

## Problem

The SpacesList.tsx code already contains all requested features (colorful initials avatars, pin/rename via context menu, amber active states), but the rendered UI still shows the old pale grey layout with small icons. This is a build/cache staleness issue -- the updated component code exists but isn't being picked up by the preview.

## Plan

### 1. Force re-render of SpacesList.tsx with hardened styling

Touch the component with minor structural tweaks to force a clean rebuild:
- Replace `bg-card` on the root container with explicit `bg-white dark:bg-slate-900` to eliminate any pale grey from CSS variable resolution
- Make avatar colors more saturated (e.g., `bg-blue-100 text-blue-700` instead of `bg-blue-500/15 text-blue-700`)
- Add subtle left-border gradient to the sidebar panel itself for visual pop

### 2. Enhance ChatPanel.tsx sidebar wrapper

The current wrapper around SpacesList has a very plain "Chats" header with basic border-r:
- Style the "Chats" header with a slightly darker background and amber accent line
- Remove the redundant `bg-card` from SpacesList since the panel already provides background

### 3. Ensure context menu (three-dot) is more discoverable

The current hover-only three-dot button (`hidden group-hover:flex`) may not be obvious:
- Show a subtle opacity-0 to opacity-100 transition instead of display:none/flex
- This ensures users discover the Rename / Pin / Hide actions

## Technical Details

### Files to modify:

**src/components/chat/SpacesList.tsx**
- Root div: change `bg-card` to `bg-white dark:bg-[hsl(220,18%,12%)]`
- Avatar colors array: bump saturation (e.g., `bg-blue-100 text-blue-600`)
- Active state: use `bg-amber-50 dark:bg-amber-500/10` instead of `bg-accent/12`
- Context menu trigger: change `hidden group-hover:flex` to `opacity-0 group-hover:opacity-100 transition-opacity`
- Search input: use `bg-slate-100 dark:bg-slate-800` instead of `bg-secondary`

**src/components/chat/ChatPanel.tsx**
- Sidebar header: add `bg-slate-50 dark:bg-slate-900` and stronger typography
- Sidebar container: use slightly tinted background
