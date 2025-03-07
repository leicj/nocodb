import { forwardRef, Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import type { Provider } from '@nestjs/common';
import { InitMetaServiceProvider } from '~/modules/global/init-meta-service.provider';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { SocketGateway } from '~/gateways/socket.gateway';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { UsersService } from '~/services/users/users.service';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { HookHandlerService } from '~/services/hook-handler.service';
import { UsersModule } from '~/modules/users/users.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (usersService: UsersService, metaService: MetaService) => {
    const config = metaService.config;

    await Noco.initJwt();

    const options = {
      // ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
      // expiresIn: '10h',
      passReqToCallback: true,
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
    };

    return new JwtStrategy(options, usersService);
  },
  inject: [UsersService, MetaService],
};

export const globalModuleMetadata = {
  imports: [EventEmitterModule, forwardRef(() => UsersModule), JobsModule],
  providers: [
    InitMetaServiceProvider,
    AppHooksService,
    JwtStrategyProvider,
    GlobalGuard,
    SocketGateway,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
    HookHandlerService,
  ],
  exports: [
    MetaService,
    JwtStrategyProvider,
    GlobalGuard,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
    HookHandlerService,
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [SocketGateway] : []),
  ],
};

@Global()
@Module(globalModuleMetadata)
export class GlobalModule {}
