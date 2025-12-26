import { Global, Module } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard';
import { UserStatusGuard } from './guards/user-status.guard';

@Global()
@Module({
  providers: [RolesGuard, UserStatusGuard],
  exports: [RolesGuard, UserStatusGuard],
})
export class CommonModule {}
