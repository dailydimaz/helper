/**
 * REST API client to replace tRPC
 */

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const url = `/api/${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || `HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}

// User API methods
export const userApi = {
  async onboard(input: { email: string; displayName: string; password: string }) {
    return makeRequest('user/onboard', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async login(input: { email: string; password: string }) {
    return makeRequest('user/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getCurrentUser() {
    return makeRequest('user/current');
  },

  async currentUser() {
    return makeRequest('user/current');
  },
};

// Mailbox API methods
export const mailboxApi = {
  async get() {
    return makeRequest('mailbox');
  },
  
  async update(data: any) {
    return makeRequest('mailbox', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getOpenCount() {
    return makeRequest('mailbox/open-count');
  },

  async runAutoClose() {
    return makeRequest('mailbox/auto-close', { method: 'POST' });
  },

  // FAQ operations
  faqs: {
    async list() {
      return makeRequest('mailbox/faqs');
    },
    
    async create(data: any) {
      return makeRequest('mailbox/faqs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async get(id: string) {
      return makeRequest(`mailbox/faqs/${id}`);
    },
    
    async update(id: string, data: any) {
      return makeRequest(`mailbox/faqs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: string) {
      return makeRequest(`mailbox/faqs/${id}`, { method: 'DELETE' });
    },
    
    async accept(data: any) {
      return makeRequest('mailbox/faqs/accept', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async reject(id: string) {
      return makeRequest('mailbox/faqs/reject', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    },
    
    async suggestFromHumanReply(data: any) {
      return makeRequest('mailbox/faqs/suggest-from-human-reply', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Conversations
  conversations: {
    async list(params?: any) {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return makeRequest(`mailbox/conversations${query}`);
    },
    
    async bulkUpdate(data: any) {
      return makeRequest('mailbox/conversations', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    
    async get(slug: string) {
      return makeRequest(`mailbox/conversations/${slug}`);
    },
    
    async update(slug: string, data: any) {
      return makeRequest(`mailbox/conversations/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    
    async findSimilar(params: any) {
      const query = `?${new URLSearchParams(params)}`;
      return makeRequest(`mailbox/conversations/find-similar${query}`);
    },

    async splitMerged(data: any) {
      return makeRequest('mailbox/conversations/split-merged', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Messages
    messages: {
      async flagAsBad(data: any) {
        return makeRequest('mailbox/conversations/messages/flag-as-bad', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      
      async previousReplies(params: any) {
        const query = `?${new URLSearchParams(params)}`;
        return makeRequest(`mailbox/conversations/messages/previous-replies${query}`);
      },
    },

    // Notes
    notes: {
      async create(data: any) {
        return makeRequest('mailbox/conversations/notes', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      
      async add(data: any) {
        return makeRequest('mailbox/conversations/notes', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      
      async delete(id: string) {
        return makeRequest(`mailbox/conversations/notes/${id}`, { method: 'DELETE' });
      },
    },

    // GitHub integration
    github: {
      async getIssues(params: any) {
        const query = `?${new URLSearchParams(params)}`;
        return makeRequest(`mailbox/conversations/github/issues${query}`);
      },
      
      async createIssue(data: any) {
        return makeRequest('mailbox/conversations/github/issues', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      
      async listRepositoryIssues(params: any) {
        const query = `?${new URLSearchParams(params)}`;
        return makeRequest(`mailbox/conversations/github/repository-issues${query}`);
      },
      
      async createGitHubIssue(data: any) {
        return makeRequest('mailbox/conversations/github/create-issue', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      
      async linkExistingGitHubIssue(data: any) {
        return makeRequest('mailbox/conversations/github/link-issue', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
    },
    
    // Tools
    tools: {
      async list(params: any) {
        const query = `?${new URLSearchParams(params)}`;
        return makeRequest(`mailbox/conversations/tools${query}`);
      },
      
      async run(data: any) {
        return makeRequest('mailbox/conversations/tools/run', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
    },
  },

  // Issue Groups
  issueGroups: {
    async list() {
      return makeRequest('mailbox/issue-groups');
    },
    
    async create(data: any) {
      return makeRequest('mailbox/issue-groups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async get(id: string) {
      return makeRequest(`mailbox/issue-groups/${id}`);
    },
    
    async update(id: string, data: any) {
      return makeRequest(`mailbox/issue-groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: string) {
      return makeRequest(`mailbox/issue-groups/${id}`, { method: 'DELETE' });
    },
    
    async listAll() {
      return makeRequest('mailbox/issue-groups/all');
    },
    
    async assignConversation(data: any) {
      return makeRequest('mailbox/issue-groups/assign-conversation', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Websites
  websites: {
    async list() {
      return makeRequest('mailbox/websites');
    },
    
    async create(data: any) {
      return makeRequest('mailbox/websites', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: string) {
      return makeRequest(`mailbox/websites/${id}`, { method: 'DELETE' });
    },
    
    async triggerCrawl(data: any) {
      return makeRequest('mailbox/websites/trigger-crawl', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async pages() {
      return makeRequest('mailbox/websites/pages');
    },
  },

  // Tools
  tools: {
    async list() {
      return makeRequest('mailbox/tools');
    },
    
    async get(id: string) {
      return makeRequest(`mailbox/tools/${id}`);
    },
    
    async update(id: string, data: any) {
      return makeRequest(`mailbox/tools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    
    async refreshApi(data: any) {
      return makeRequest('mailbox/tools/refresh-api', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async deleteApi(data: any) {
      return makeRequest('mailbox/tools/delete-api', {
        method: 'DELETE',
        body: JSON.stringify(data),
      });
    },
  },

  // Customers
  customers: {
    async list(params?: any) {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return makeRequest(`mailbox/customers${query}`);
    },
  },

  // Members
  members: {
    async list() {
      return makeRequest('mailbox/members');
    },
    
    async remove(id: string) {
      return makeRequest(`mailbox/members/${id}`, { method: 'DELETE' });
    },
  },

  // GitHub integration
  github: {
    async disconnect() {
      return makeRequest('mailbox/github', { method: 'DELETE' });
    },
  },

  // Slack integration
  slack: {
    async disconnect() {
      return makeRequest('mailbox/slack', { method: 'DELETE' });
    },
  },

  // Saved replies
  savedReplies: {
    async list() {
      return makeRequest('mailbox/saved-replies');
    },
    
    async create(data: any) {
      return makeRequest('mailbox/saved-replies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async update(id: string, data: any) {
      return makeRequest(`mailbox/saved-replies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: string) {
      return makeRequest(`mailbox/saved-replies/${id}`, { method: 'DELETE' });
    },
  },
  
  // Metadata endpoint operations
  metadataEndpoint: {
    async test(params?: any) {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return makeRequest(`mailbox/metadata-endpoint/test${query}`);
    },
    
    async create(data: any) {
      return makeRequest('mailbox/metadata-endpoint', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    async delete(id: string) {
      return makeRequest(`mailbox/metadata-endpoint/${id}`, { method: 'DELETE' });
    },
  },
};

// Organization API methods
export const organizationApi = {
  async getMembers() {
    return makeRequest('organization/members');
  },
  
  members: {
    async list() {
      return makeRequest('organization/members');
    },
  },
};

// Gmail Support Email API
export const gmailSupportEmailApi = {
  async get() {
    return makeRequest('gmail-support-email');
  },
  
  async disconnect() {
    return makeRequest('gmail-support-email', { method: 'DELETE' });
  },
};

// Export the main api object
export const api = {
  user: userApi,
  mailbox: mailboxApi,
  organization: organizationApi,
  gmailSupportEmail: gmailSupportEmailApi,
};

export { ApiError };