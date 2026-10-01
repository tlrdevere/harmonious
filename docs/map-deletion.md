# Deleting your own maps

In **Map Library → My maps**, each saved map you own offers **Delete map** beside Open map and Copy map. The confirmation names the map, explains the effects, and initially focuses Cancel. Escape cancels. Deletion is not available while facilitating.

Deleting removes the map from personal and shared browsing, map pickers, copying and new comparisons. Existing comparisons show an unavailable source and cannot accept new contributions. Independent copies and historical records remain; this is not a purge of other participants’ records or stored history. Internally, the canonical map is retained privately with an immutable deletion marker to preserve references. There is no restore action.

The last map can be deleted. The empty library offers Create your first map, and opening the account does not generate a replacement. Deleted maps cannot be restored by stale tabs, autosave or an imported record with the same identity. Users may create new maps afterward.

Deletion is an authenticated, same-origin operation with an ownership check and the saved revision from the confirmation. A change in another session requires reviewing the map again. Retrying after a lost acknowledgement returns the saved result without deleting twice. The API rejects deletion markers through ordinary saves or facilitator batches. The database independently checks ownership context, freezes deleted maps and rejects new contributions to deleted sources.

The map-deletion-v1 capability allows empty account workspaces. Older tabs receive an update message when their map library becomes empty. Client projections never expose a deleted map’s current contents. Copies and the owner’s wording history may retain previously saved wording, just as they do when a shared map becomes private.

Migration: 20261001173221_map_deletion.sql. Do not roll back to a server that ignores deletion markers once any map has been deleted.
