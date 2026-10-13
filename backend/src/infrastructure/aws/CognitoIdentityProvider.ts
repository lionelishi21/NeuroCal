import { AdminDeleteUserCommand, CognitoIdentityProviderClient, UserNotFoundException } from "@aws-sdk/client-cognito-identity-provider";
import type { IIdentityProvider } from "../../application/interfaces/IIdentityProvider";

/** Removes sign-ins from the stack's Cognito user pool. In a pool that signs in by email, the subject is the username. */
export class CognitoIdentityProvider implements IIdentityProvider {
  private readonly client: CognitoIdentityProviderClient;

  constructor(private readonly options: { userPoolId: string; client?: CognitoIdentityProviderClient }) {
    this.client = options.client ?? new CognitoIdentityProviderClient({});
  }

  async deleteLogin(subject: string) {
    try {
      await this.client.send(new AdminDeleteUserCommand({ UserPoolId: this.options.userPoolId, Username: subject }));
    } catch (error) {
      if (!(error instanceof UserNotFoundException)) throw error;
    }
  }
}
