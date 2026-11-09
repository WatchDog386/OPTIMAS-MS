-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE INDEX "Attendance_dressReview_workDate_idx" ON "Attendance"("dressReview", "workDate");

-- CreateIndex
CREATE INDEX "Attendance_checkOutReview_workDate_idx" ON "Attendance"("checkOutReview", "workDate");

-- CreateIndex
CREATE INDEX "Attendance_userId_workDate_idx" ON "Attendance"("userId", "workDate" DESC);

-- CreateIndex
CREATE INDEX "Task_status_endedAt_idx" ON "Task"("status", "endedAt");

-- CreateIndex
CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_customerAccount_idx" ON "Task"("customerAccount");

-- CreateIndex
CREATE INDEX "SerialUnit_status_idx" ON "SerialUnit"("status");

-- CreateIndex
CREATE INDEX "SerialUnit_customerAccount_idx" ON "SerialUnit"("customerAccount");

-- CreateIndex
CREATE INDEX "StockMovement_serialUnitId_createdAt_idx" ON "StockMovement"("serialUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_createdAt_idx" ON "ServiceRequest"("customerId", "createdAt");

