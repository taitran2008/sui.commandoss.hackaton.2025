# SUI Task Management - Host Parameter Feature

## Overview
This feature allows viewing tasks/jobs for any SUI address without requiring wallet connection by using a URL parameter.

## Usage

### 1. Normal Mode (Wallet Required)
```
http://localhost:3001/
```
- Requires wallet connection
- Full functionality: create, view, manage, delete jobs
- Shows only jobs from connected wallet

### 2. Host Parameter Mode (Read-Only)
```
http://localhost:3001/?host=0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de
```
- No wallet connection required
- Read-only view of jobs for specified address
- Cannot create or manage jobs
- Perfect for sharing or public viewing

## Features

### When using `?host=ADDRESS` parameter:
- ✅ View all jobs for the specified address
- ✅ See job details, status, rewards
- ✅ Filter and sort jobs
- ✅ Refresh job data from blockchain
- ✅ Cannot create new jobs (form hidden)
- ✅ Cannot delete or modify jobs (disabled in read-only mode)
- ✅ Job management panel hidden in read-only mode
- ✅ Wallet connection section hidden

### Visual Indicators:
- Blue info banner showing the address being viewed
- Updated page title and descriptions
- "Read-only view" messages in task cards
- Modified empty state messages for host viewing

## Implementation Details

### Modified Components:
1. **`page.tsx`** - Added URL parameter reading with Suspense
2. **`useSuiJobs` hook** - Added optional `hostAddress` parameter  
3. **`TaskList` component** - Added conditional rendering based on host mode
4. **`TaskCard` component** - Added `readOnly` prop to disable actions and management panel

### How it works:
1. URL parameter `host` is read from search params
2. Passed down to `TaskList` component  
3. `useSuiJobs` hook uses host address instead of wallet address
4. UI adapts to show read-only mode with appropriate messaging
5. TaskForm is hidden when using host parameter
6. TaskCard actions are disabled and management panel is hidden
7. Empty states show appropriate messages for host viewing

## Example URLs

```bash
# View jobs for a specific address
http://localhost:3001/?host=0x1234567890abcdef1234567890abcdef12345678

# Normal wallet mode
http://localhost:3001/

# With custom host address
http://localhost:3001/?host=0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de
```

## Benefits
- **Public sharing**: Share job views without requiring wallet setup
- **Read-only access**: Safe viewing without modification capabilities  
- **Cross-wallet viewing**: See jobs from any SUI address
- **No authentication**: Works immediately without wallet connection
- **Preserved functionality**: All viewing features work normally
