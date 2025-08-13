"use client";

// React hooks for REST API to replace tRPC functionality
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api/client';

// Create a simple query hook
function useQuery(key: string[], queryFn: () => Promise<any>, options: any = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (options.enabled === false) {
      setIsLoading(false);
      return;
    }

    queryFn()
      .then(result => {
        setData(result);
        setError(null);
      })
      .catch(err => {
        setError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [JSON.stringify(key), options.enabled]);

  return { data, isLoading, error };
}

// Create a simple mutation hook
function useMutation(mutationFn: (variables?: any) => Promise<any>, options: any = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (variables?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await mutationFn(variables);
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      return result;
    } catch (err) {
      setError(err);
      if (options.onError) {
        options.onError(err);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const mutateAsync = mutate;

  return { mutate, mutateAsync, isLoading, error };
}

// Create the API object with React hooks
const createApiProxy = (basePath: any[] = []): any => {
  return new Proxy({}, {
    get: (target, prop: string) => {
      const currentPath = [...basePath, prop];
      
      // Special handling for common tRPC operations
      if (prop === 'useQuery') {
        return (input?: any, options?: any) => {
          return useQuery(currentPath, async () => {
            const pathStr = currentPath.slice(0, -1).join('.');
            // Convert tRPC path to REST endpoint
            
            // User queries
            if (pathStr === 'user.current' || pathStr === 'user.currentUser') {
              return api.user.getCurrentUser();
            }
            
            // Organization queries  
            if (pathStr === 'organization.getMembers') {
              return api.organization.getMembers();
            }
            
            // Mailbox queries
            if (pathStr === 'mailbox.get') {
              return api.mailbox.get();
            }
            if (pathStr === 'mailbox.openCount') {
              return api.mailbox.getOpenCount();
            }
            
            // FAQ queries
            if (pathStr === 'mailbox.faqs.list') {
              return api.mailbox.faqs.list();
            }
            
            // Conversation queries
            if (pathStr === 'mailbox.conversations.list') {
              return api.mailbox.conversations.list(input);
            }
            if (pathStr === 'mailbox.conversations.get') {
              return api.mailbox.conversations.get(input);
            }
            if (pathStr === 'mailbox.conversations.findSimilar') {
              return api.mailbox.conversations.findSimilar(input);
            }
            
            // Issue Groups queries
            if (pathStr === 'mailbox.issueGroups.listAll') {
              return api.mailbox.issueGroups.listAll();
            }
            
            // Customer queries
            if (pathStr === 'mailbox.customers.list') {
              return api.mailbox.customers.list(input);
            }
            
            // Website queries
            if (pathStr === 'mailbox.websites.list') {
              return api.mailbox.websites.list();
            }
            if (pathStr === 'mailbox.websites.pages') {
              return api.mailbox.websites.pages();
            }
            
            // Tools queries
            if (pathStr === 'mailbox.conversations.tools.list') {
              return api.mailbox.conversations.tools.list(input);
            }
            
            // Messages queries
            if (pathStr === 'mailbox.conversations.messages.previousReplies') {
              return api.mailbox.conversations.messages.previousReplies(input);
            }
            
            // GitHub queries
            if (pathStr === 'mailbox.conversations.github.listRepositoryIssues') {
              return api.mailbox.conversations.github.listRepositoryIssues(input);
            }
            
            // Gmail Support Email queries
            if (pathStr === 'gmailSupportEmail.get') {
              return api.gmailSupportEmail.get();
            }
            
            // Metadata endpoint queries
            if (pathStr === 'mailbox.metadataEndpoint.test') {
              return api.mailbox.metadataEndpoint.test(input);
            }
            
            // Default fallback
            console.warn(`Unhandled useQuery path: ${pathStr}`);
            return null;
          }, options);
        };
      }
      
      if (prop === 'useMutation') {
        return (options?: any) => {
          return useMutation(async (variables: any) => {
            const pathStr = currentPath.slice(0, -1).join('.');
            // Convert tRPC path to REST endpoint
            
            // User mutations
            if (pathStr === 'user.onboard') {
              return api.user.onboard(variables);
            }
            
            // Mailbox mutations
            if (pathStr === 'mailbox.update') {
              return api.mailbox.update(variables);
            }
            if (pathStr === 'mailbox.autoClose') {
              return api.mailbox.runAutoClose();
            }
            
            // FAQ mutations
            if (pathStr === 'mailbox.faqs.create') {
              return api.mailbox.faqs.create(variables);
            }
            if (pathStr === 'mailbox.faqs.update') {
              return api.mailbox.faqs.update(variables.id, variables);
            }
            if (pathStr === 'mailbox.faqs.accept') {
              return api.mailbox.faqs.accept(variables);
            }
            if (pathStr === 'mailbox.faqs.reject') {
              return api.mailbox.faqs.reject(variables.id || variables);
            }
            if (pathStr === 'mailbox.faqs.suggestFromHumanReply') {
              return api.mailbox.faqs.suggestFromHumanReply(variables);
            }
            
            // Issue Group mutations
            if (pathStr === 'mailbox.issueGroups.create') {
              return api.mailbox.issueGroups.create(variables);
            }
            if (pathStr === 'mailbox.issueGroups.update') {
              return api.mailbox.issueGroups.update(variables.id, variables);
            }
            if (pathStr === 'mailbox.issueGroups.delete') {
              return api.mailbox.issueGroups.delete(variables.id || variables);
            }
            if (pathStr === 'mailbox.issueGroups.assignConversation') {
              return api.mailbox.issueGroups.assignConversation(variables);
            }
            
            // Website mutations
            if (pathStr === 'mailbox.websites.create') {
              return api.mailbox.websites.create(variables);
            }
            if (pathStr === 'mailbox.websites.delete') {
              return api.mailbox.websites.delete(variables.id || variables);
            }
            if (pathStr === 'mailbox.websites.triggerCrawl') {
              return api.mailbox.websites.triggerCrawl(variables);
            }
            
            // Tool mutations
            if (pathStr === 'mailbox.tools.update') {
              return api.mailbox.tools.update(variables.id, variables);
            }
            if (pathStr === 'mailbox.tools.refreshApi') {
              return api.mailbox.tools.refreshApi(variables);
            }
            if (pathStr === 'mailbox.tools.deleteApi') {
              return api.mailbox.tools.deleteApi(variables);
            }
            
            // Conversation mutations
            if (pathStr === 'mailbox.conversations.bulkUpdate') {
              return api.mailbox.conversations.bulkUpdate(variables);
            }
            if (pathStr === 'mailbox.conversations.splitMerged') {
              return api.mailbox.conversations.splitMerged(variables);
            }
            
            // Conversation tool mutations
            if (pathStr === 'mailbox.conversations.tools.run') {
              return api.mailbox.conversations.tools.run(variables);
            }
            
            // Message mutations
            if (pathStr === 'mailbox.conversations.messages.flagAsBad') {
              return api.mailbox.conversations.messages.flagAsBad(variables);
            }
            
            // Note mutations
            if (pathStr === 'mailbox.conversations.notes.add') {
              return api.mailbox.conversations.notes.add(variables);
            }
            if (pathStr === 'mailbox.conversations.notes.delete') {
              return api.mailbox.conversations.notes.delete(variables.id || variables);
            }
            
            // GitHub mutations
            if (pathStr === 'mailbox.conversations.github.createGitHubIssue') {
              return api.mailbox.conversations.github.createGitHubIssue(variables);
            }
            if (pathStr === 'mailbox.conversations.github.linkExistingGitHubIssue') {
              return api.mailbox.conversations.github.linkExistingGitHubIssue(variables);
            }
            if (pathStr === 'mailbox.github.disconnect') {
              return api.mailbox.github.disconnect();
            }
            
            // Slack mutations
            if (pathStr === 'mailbox.slack.disconnect') {
              return api.mailbox.slack.disconnect();
            }
            
            // Member mutations
            if (pathStr === 'mailbox.members.delete') {
              return api.mailbox.members.remove(variables.id || variables);
            }
            
            // Gmail Support Email mutations
            if (pathStr === 'gmailSupportEmail.delete') {
              return api.gmailSupportEmail.disconnect();
            }
            
            // Metadata Endpoint mutations
            if (pathStr === 'mailbox.metadataEndpoint.create') {
              return api.mailbox.metadataEndpoint.create(variables);
            }
            if (pathStr === 'mailbox.metadataEndpoint.delete') {
              return api.mailbox.metadataEndpoint.delete(variables.id || variables);
            }
            
            // Default fallback
            console.error(`Mutation not implemented: ${pathStr}`);
            throw new Error(`Mutation not implemented: ${pathStr}`);
          }, options);
        };
      }
      
      if (prop === 'useInfiniteQuery') {
        return (input?: any, options?: any) => {
          const pathStr = currentPath.slice(0, -1).join('.');
          const [data, setData] = useState(null);
          const [isLoading, setIsLoading] = useState(true);
          const [error, setError] = useState(null);
          const [hasNextPage, setHasNextPage] = useState(false);
          
          useEffect(() => {
            if (options.enabled === false) {
              setIsLoading(false);
              return;
            }
            
            // For now, treat as regular query - could be enhanced for pagination
            const fetchData = async () => {
              try {
                let result = null;
                
                if (pathStr === 'mailbox.conversations.list') {
                  result = await api.mailbox.conversations.list(input);
                }
                
                if (result) {
                  // Format data for infinite query structure
                  setData({
                    pages: [result],
                    pageParams: [undefined]
                  });
                  setHasNextPage(false); // No pagination implemented yet
                } else {
                  setData(null);
                }
                setError(null);
              } catch (err) {
                setError(err);
              } finally {
                setIsLoading(false);
              }
            };
            
            fetchData();
          }, [JSON.stringify(input), options.enabled]);
          
          return {
            data,
            isLoading,
            error,
            fetchNextPage: () => Promise.resolve(), // Placeholder
            hasNextPage,
            isFetchingNextPage: false
          };
        };
      }
      
      if (prop === 'useUtils') {
        return () => createUtilsProxy();
      }
      
      // Continue building the path
      return createApiProxy(currentPath);
    }
  });
};

// Create utils proxy for invalidation/refetching
const createUtilsProxy = (): any => {
  return new Proxy({}, {
    get: (target, namespace: string) => {
      return new Proxy({}, {
        get: (target, operation: string) => {
          return new Proxy({}, {
            get: (target, method: string) => {
              const pathStr = `${namespace}.${operation}.${method}`;
              
              return {
                invalidate: () => {
                  console.log(`Invalidating cache for: ${pathStr}`);
                  // For now, just log. In a full implementation, this would
                  // invalidate React Query cache or trigger re-fetches
                  if (typeof window !== 'undefined') {
                    window.location.reload(); // Temporary: force reload on invalidation
                  }
                },
                refetch: async () => {
                  console.log(`Refetching data for: ${pathStr}`);
                  // Placeholder for refetch logic
                  return Promise.resolve();
                },
                setData: (newData: any) => {
                  console.log(`Setting data for: ${pathStr}`, newData);
                  // Placeholder for setting cached data
                }
              };
            }
          });
        }
      });
    }
  });
};

// Create the main API proxy
const apiProxy = createApiProxy();
apiProxy.useUtils = () => createUtilsProxy();

export { apiProxy as api };

// Export React Query context stubs
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}