export interface Rule {
    id: string;
    name: string;
    author: string;
    description: string;
    tech: "next";
    severity: "info" | "low" | "medium" | "high";
    type: "request" | "esquery";
    steps: Step[];
}

export type Step = {
    name: string;
    message: string;
    requires?: string[];
    request?: RequestStep;
    esquery?: EsqueryStep
    postMessageFuncResolve?: PostMessageFuncResolverStep;
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
      }
    | {
          type: "method";
          condition: "is" | "is_not";
          name: string;
      };

export type EsqueryStep = {
    type: "esquery";
    query: string;
};

export type PostMessageFuncResolverStep = {
    name: string;
};
