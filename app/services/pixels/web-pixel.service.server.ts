type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: {
      variables?: Record<string, unknown>;
    },
  ) => Promise<Response>;
};

type WebPixelRecord = {
  id: string;
  settings: {
    conversionApiUrl?: string;
    reportPaymentToken?: string;
  } | null;
};

type GraphqlUserError = {
  code?: string | null;
  field?: string[] | null;
  message: string;
};

async function parseGraphqlResponse<T>(response: Response) {
  const payload = (await response.json()) as T & {
    errors?: Array<{message: string}>;
  };

  if (payload.errors?.length) {
    console.error("[web-pixel] GraphQL top-level errors", payload.errors);
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  return payload;
}

function isMissingWebPixelError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("No web pixel was found for this app.")
  );
}

function parsePixelSettings(settings: unknown) {
  if (!settings) {
    return null;
  }

  if (typeof settings === "string") {
    try {
      return JSON.parse(settings) as WebPixelRecord["settings"];
    } catch {
      return null;
    }
  }

  if (typeof settings === "object") {
    return settings as WebPixelRecord["settings"];
  }

  return null;
}

export async function getInstalledWebPixel(admin: AdminGraphqlClient) {
  console.log("[web-pixel] Querying installed web pixel");
  try {
    const response = await admin.graphql(`#graphql
      query GetInstalledWebPixel {
        webPixel {
          id
          settings
        }
      }
    `);

    const payload = await parseGraphqlResponse<{
      data?: {
        webPixel: {
          id: string;
          settings: unknown;
        } | null;
      };
    }>(response);

    const webPixel = payload.data?.webPixel;

    if (!webPixel) {
      console.log("[web-pixel] No installed web pixel found");
      return null;
    }

    console.log("[web-pixel] Installed web pixel found", {
      id: webPixel.id,
      settings: webPixel.settings,
    });

    return {
      id: webPixel.id,
      settings: parsePixelSettings(webPixel.settings),
    } satisfies WebPixelRecord;
  } catch (error) {
    if (isMissingWebPixelError(error)) {
      console.log("[web-pixel] No installed web pixel found for this app yet");
      return null;
    }

    throw error;
  }
}

export async function upsertWebPixel(
  admin: AdminGraphqlClient,
  input: {conversionApiUrl: string; reportPaymentToken: string},
) {
  console.log("[web-pixel] Upsert requested", input);
  const existingPixel = await getInstalledWebPixel(admin);

  if (!existingPixel) {
    console.log("[web-pixel] Creating web pixel");
    const response = await admin.graphql(
      `#graphql
        mutation CreateWebPixel($webPixel: WebPixelInput!) {
          webPixelCreate(webPixel: $webPixel) {
            userErrors {
              code
              field
              message
            }
            webPixel {
              id
              settings
            }
          }
        }
      `,
      {
        variables: {
          webPixel: {
            settings: {
              conversionApiUrl: input.conversionApiUrl,
              reportPaymentToken: input.reportPaymentToken,
            },
          },
        },
      },
    );

    const payload = await parseGraphqlResponse<{
      data?: {
        webPixelCreate: {
          userErrors: GraphqlUserError[];
          webPixel: {
            id: string;
            settings: unknown;
          } | null;
        };
      };
    }>(response);

    const result = payload.data?.webPixelCreate;

    if (!result || result.userErrors.length > 0 || !result.webPixel) {
      console.error("[web-pixel] webPixelCreate failed", result);
      throw new Error(
        result?.userErrors.map((error) => error.message).join(", ") ||
          "Unable to create web pixel",
      );
    }

    console.log("[web-pixel] webPixelCreate succeeded", result.webPixel);
    return {
      id: result.webPixel.id,
      settings: parsePixelSettings(result.webPixel.settings),
    } satisfies WebPixelRecord;
  }

  console.log("[web-pixel] Updating existing web pixel", {
    id: existingPixel.id,
  });
  const response = await admin.graphql(
    `#graphql
      mutation UpdateWebPixel($id: ID!, $webPixel: WebPixelInput!) {
        webPixelUpdate(id: $id, webPixel: $webPixel) {
          userErrors {
            code
            field
            message
          }
          webPixel {
            id
            settings
          }
        }
      }
    `,
    {
      variables: {
        id: existingPixel.id,
        webPixel: {
          settings: {
            conversionApiUrl: input.conversionApiUrl,
            reportPaymentToken: input.reportPaymentToken,
          },
        },
      },
    },
  );

  const payload = await parseGraphqlResponse<{
    data?: {
      webPixelUpdate: {
        userErrors: GraphqlUserError[];
        webPixel: {
          id: string;
          settings: unknown;
        } | null;
      };
    };
  }>(response);

  const result = payload.data?.webPixelUpdate;

  if (!result || result.userErrors.length > 0 || !result.webPixel) {
    console.error("[web-pixel] webPixelUpdate failed", result);
    throw new Error(
      result?.userErrors.map((error) => error.message).join(", ") ||
        "Unable to update web pixel",
    );
  }

  console.log("[web-pixel] webPixelUpdate succeeded", result.webPixel);
  return {
    id: result.webPixel.id,
    settings: parsePixelSettings(result.webPixel.settings),
  } satisfies WebPixelRecord;
}
