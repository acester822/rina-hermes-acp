import * as vscode from 'vscode';
import { HermesChatProvider } from './chat/HermesChatProvider';

let chatProvider: HermesChatProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Hermes Agent Chat activating...');

    // Register the chat webview provider
    chatProvider = new HermesChatProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('hermesChat', chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('hermes.newChat', () => {
            chatProvider?.newChat();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('hermes.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.hermes-sidebar');
        })
    );

    console.log('Hermes Agent Chat activated');
}

export function deactivate() {
    chatProvider?.dispose();
}
