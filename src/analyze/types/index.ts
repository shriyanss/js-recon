export interface Rule {
    id: string;
    name: string;
    author: string;
    description: string;
    tech: "next";
    severity: "info" | "low" | "medium" | "high";
    type: "request";
    steps: Step[];
}

export type Step = {
    name: string;
    message: string;
    requires?: string[];
    request: RequestStep;
};

export type RequestStep =
    | {
          type: "headers";
          condition: "contains" | "absent";
          name: string;
      }
    | {
          type: "url";
          condition: "contains" | "absent";
          name: string;
      };
