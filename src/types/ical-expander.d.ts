declare module 'ical-expander' {
  interface IcalExpanderOptions {
    ics: string;
    maxIterations?: number;
  }

  interface IcalDate {
    toJSDate(): Date;
    hasTime: boolean;
  }

  interface IcalEvent {
    uid?: string;
    summary?: string;
    description?: string;
    location?: string;
    startDate: IcalDate;
    endDate: IcalDate;
  }

  interface IcalOccurrence {
    uid?: string;
    summary?: string;
    description?: string;
    location?: string;
    startDate: IcalDate;
    endDate: IcalDate;
  }

  interface ExpandedEvents {
    events: IcalEvent[];
    occurrences: IcalOccurrence[];
  }

  class IcalExpander {
    constructor(options: IcalExpanderOptions);
    between(after: Date, before: Date): ExpandedEvents;
  }

  export = IcalExpander;
}
