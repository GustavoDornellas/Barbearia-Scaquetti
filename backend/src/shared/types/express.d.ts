declare namespace Express {
  export interface Request {
    csrfToken?: () => string;
  }
}

