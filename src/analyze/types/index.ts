export interface Rule {
    id: string;
    name: string;
    author: string;
    description: string;
    tech: ("next"|"all")[];
    severity: "info" | "low" | "medium" | "high";
    type: "request" | "esquery";
    steps: Step[];
}

export type Step = {
    name: string;
    message: string;
    requires?: string[];
    request?: RequestStep; // used for openapi
    esquery?: EsqueryStep; // parse an esquery string
    postMessageFuncResolve?: PostMessageFuncResolverStep; // get the second argument of the addEventListener("message", ...) call expression
    checkAssignmentExist?: CheckAssignmentExistStep; // check if a function exists in the node
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

export type CheckAssignmentExistStep = {
    name: string;
    type: "innerHTML";
    memberExpression?: boolean;
};
