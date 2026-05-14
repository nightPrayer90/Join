import { Component, computed, inject, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Supabase } from '../../service/supabase';
import { TasksModel } from '../../shared/models/tasks-model';
import { ContactsModel } from '../../shared/models/contacts-model';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-summary',
  imports: [RouterLink],
  templateUrl: './summary.html',
  styleUrl: './summary.scss',
})
export class Summary {
  dbService: Supabase = inject(Supabase);
  private route = inject(ActivatedRoute);

  nextUpcomingTask = computed<TasksModel | null>(() => this.getNextTask());
  nextPriority = computed<number>(() => this.getNextPriority());
  nextPriorityLabel = computed<string>(() => this.getNextPriorityLabel());
  nextDate = computed<string>(() => this.getNextDate());
  todoCount = computed<number>(() => this.getCountByStatus('todo'));
  doneCount = computed<number>(() => this.getCountByStatus('done'));
  inProgressCount = computed<number>(() => this.getCountByStatus('in-progress'));
  awaitFeedbackCount = computed<number>(() => this.getCountByStatus('await-feedback'));
  showWelcomeScreen = signal<boolean>(false);
  isFadingOut = signal<boolean>(false);
  userString = computed<string>(() => this.getUserName());
  timeString = computed<string>(() => this.getTimeString());

  constructor() {
    this.getUserName();
    this.getTimeString();
    this.handleWelcomeScreen();
  }

  handleWelcomeScreen(): void {
    if (this.route.snapshot.paramMap.get('myParam') === '') return;

    if (window.innerWidth < 768) {
      this.showWelcomeScreen.set(true);
      setTimeout(() => this.isFadingOut.set(true), 2500);
      setTimeout(() => this.showWelcomeScreen.set(false), 3500);
    } else this.showWelcomeScreen.set(false);
  }

  getCountByStatus(status: string): number {
    const filterCount: number = this.dbService
      .tasksList()
      .filter((task) => task.task_status === status).length;
    return filterCount;
  }

  getNextTask(): TasksModel | null {
    const filteredTasks: TasksModel[] = this.dbService
      .tasksList()
      .filter((task) => task.task_status !== 'done');
    if (!filteredTasks.length) return null;

    let nextTask: TasksModel = filteredTasks[0];
    for (let i = 1; i < filteredTasks.length; i++) {
      if (filteredTasks[i].dateISO < nextTask.dateISO) {
        nextTask = filteredTasks[i];
      }
    }
    return nextTask;
  }

  getNextPriority(): number {
    const task: TasksModel | null = this.nextUpcomingTask();
    if (task !== null && task.priority !== undefined) {
      return task.priority;
    }
    return -1;
  }

  getNextPriorityLabel(): string {
    switch (this.nextPriority()) {
      case 1:
        return 'Urgent';
      case 2:
        return 'Medium';
      case 3:
        return 'Low';
      default:
        return '-';
    }
  }

  getNextDate(): string {
    const task: TasksModel | null = this.nextUpcomingTask();
    if (task !== null) {
      return task.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return '-';
  }

  getTimeString(): string {
    const currentHour: number = new Date().getHours();
    let greeting = 'Good night';
    if (currentHour >= 5 && currentHour < 12) greeting = 'Good morning';
    else if (currentHour >= 12 && currentHour < 18) greeting = 'Good afternoon';
    else if (currentHour >= 18 && currentHour < 22) greeting = 'Good evening';

    const user: User | null = this.dbService.user();
    const sign = user !== null && !user.is_anonymous ? ',' : '!';
    return greeting + sign;
  }

  getUserName(): string {
    const user: User | null = this.dbService.user();
    if (user === null || user.is_anonymous) return '';
    const email: string = user.email?.toLowerCase() ?? '';
    const contactModel: ContactsModel | undefined = this.dbService
      .contactsList()
      .find((contact) => contact.email.toLowerCase() === email);
    return contactModel === undefined ? '' : contactModel.full_name;
  }
}
