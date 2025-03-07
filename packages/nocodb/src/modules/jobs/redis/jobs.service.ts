import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import {
  InstanceCommands,
  InstanceTypes,
  JOBS_QUEUE,
  JobStatus,
} from '~/interface/Jobs';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';

@Injectable()
export class JobsService implements OnModuleInit {
  protected logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly jobsRedisService: JobsRedisService,
  ) {}

  // pause primary instance queue
  async onModuleInit() {
    await this.toggleQueue();

    this.jobsRedisService.workerCallbacks[InstanceCommands.RESUME_LOCAL] =
      async () => {
        this.logger.log('Resuming local queue');
        await this.jobsQueue.resume(true);
      };
    this.jobsRedisService.workerCallbacks[InstanceCommands.PAUSE_LOCAL] =
      async () => {
        this.logger.log('Pausing local queue');
        await this.jobsQueue.pause(true);
      };
  }

  async toggleQueue() {
    if (process.env.NC_WORKER_CONTAINER === 'false') {
      await this.jobsQueue.pause(true);
    } else if (process.env.NC_WORKER_CONTAINER !== 'true') {
      // resume primary instance queue if there is no worker
      const workerCount = await this.jobsRedisService.workerCount();
      const localWorkerPaused = await this.jobsQueue.isPaused(true);

      // if there is no worker and primary instance queue is paused, resume it
      // if there is any worker and primary instance queue is not paused, pause it
      if (workerCount === 0 && localWorkerPaused) {
        await this.jobsQueue.resume(true);
      } else if (workerCount > 0 && !localWorkerPaused) {
        await this.jobsQueue.pause(true);
      }
    }
  }

  async add(name: string, data: any) {
    await this.toggleQueue();

    const job = await this.jobsQueue.add(name, data);

    return job;
  }

  async jobStatus(jobId: string) {
    const job = await this.jobsQueue.getJob(jobId);
    if (job) {
      return await job.getState();
    }
  }

  async jobList() {
    return await this.jobsQueue.getJobs([
      JobStatus.ACTIVE,
      JobStatus.WAITING,
      JobStatus.DELAYED,
      JobStatus.PAUSED,
    ]);
  }

  async getJobWithData(data: any) {
    const jobs = await this.jobsQueue.getJobs([
      // 'completed',
      JobStatus.WAITING,
      JobStatus.ACTIVE,
      JobStatus.DELAYED,
      // 'failed',
      JobStatus.PAUSED,
    ]);

    const job = jobs.find((j) => {
      for (const key in data) {
        if (j.data[key]) {
          if (j.data[key] !== data[key]) return false;
        } else {
          return false;
        }
      }
      return true;
    });

    return job;
  }

  async resumeQueue() {
    this.logger.log('Resuming global queue');
    await this.jobsQueue.resume();
  }

  async pauseQueue() {
    this.logger.log('Pausing global queue');
    await this.jobsQueue.pause();
  }

  async emitWorkerCommand(command: InstanceCommands, ...args: any[]) {
    const data = `${command}${args.length ? `:${args.join(':')}` : ''}`;
    await this.jobsRedisService.publish(InstanceTypes.WORKER, data);
  }

  async emitPrimaryCommand(command: InstanceCommands, ...args: any[]) {
    const data = `${command}${args.length ? `:${args.join(':')}` : ''}`;
    await this.jobsRedisService.publish(InstanceTypes.PRIMARY, data);
  }
}
