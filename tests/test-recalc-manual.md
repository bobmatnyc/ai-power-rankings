# Manual Test Instructions for Recalculation Preview/Apply Flow

## Test Steps

1. **Open the Admin Panel**
   - Navigate to: http://localhost:3001/admin
   - Login with password: Ai2025PowerRankings!

2. **Navigate to Article Management**
   - Click on "News Articles" in the admin panel
   - Go to the "Edit / Delete Articles" tab

3. **Test Preview Flow**
   - Find any article with tool mentions
   - Click the "Preview" button (with Eye icon) instead of old "Recalc" button
   - Observe:
     - Progress indicator shows preview steps
     - Modal opens showing proposed changes
     - Changes are NOT applied to database

4. **Test Apply Flow**
   - In the preview modal, click "Apply Changes"
   - Observe:
     - Fast processing (uses cached AI analysis)
     - Success message appears
     - Modal closes
     - Rankings are updated

5. **Test Cancel Flow**
   - Click "Preview" on another article
   - Click "Cancel" in the modal
   - Verify no changes were made

## Expected Behavior

### Preview Button (Old Recalc)
- Changed from "Recalc" to "Preview" with Eye icon
- Shows progress percentage during processing
- Opens modal with proposed changes
- Does NOT modify database

### Preview Modal
- Shows summary of affected tools
- Lists all tool score changes
- Has "Cancel" and "Apply Changes" buttons
- Shows note about cached AI analysis

### Apply Changes
- Uses cached analysis from preview (much faster)
- Actually updates the database
- Shows success message
- Closes modal automatically

## Console Verification

Open browser console to see:
- SSE progress events during preview
- "dryRun=true" in preview requests
- "useCachedAnalysis=true" in apply requests

## Success Criteria
✅ Preview shows changes without saving
✅ Apply commits changes to database
✅ Cancel discards preview
✅ Progress tracking works for both operations
✅ Cached analysis speeds up apply operation