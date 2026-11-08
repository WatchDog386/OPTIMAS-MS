-- Stock counts compared codes letter for letter, so a router scanned by its other SN form or MAC, or
-- one already installed, raised a false "Stock count mismatch" alert. Counts now match every form of a
-- code and reconciliation re-checks past counts, so those old alerts are removed from the inboxes (the
-- counts themselves are kept).
DELETE FROM "Notification" WHERE type = 'STOCK_COUNT_MISMATCH';
