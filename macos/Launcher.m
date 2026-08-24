#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <stdio.h>
#import <stdlib.h>
#import <string.h>

@interface OPSAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, assign) BOOL selfTest;
@end

@implementation OPSAppDelegate

- (void)showFatalError:(NSString *)message {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.alertStyle = NSAlertStyleCritical;
  alert.messageText = @"无法启动雅砻江运维智能体系统";
  alert.informativeText = message;
  [alert addButtonWithTitle:@"退出"];
  [alert runModal];
  [NSApp terminate:nil];
}

- (void)installApplicationMenu {
  NSMenu *mainMenu = [[NSMenu alloc] initWithTitle:@""];

  NSMenuItem *applicationMenuItem = [[NSMenuItem alloc] initWithTitle:@"" action:nil keyEquivalent:@""];
  NSMenu *applicationMenu = [[NSMenu alloc] initWithTitle:@"雅砻江运维智能体系统"];
  [applicationMenu addItemWithTitle:@"关于雅砻江运维智能体系统"
                              action:@selector(orderFrontStandardAboutPanel:)
                       keyEquivalent:@""];
  [applicationMenu addItem:[NSMenuItem separatorItem]];
  [applicationMenu addItemWithTitle:@"隐藏"
                              action:@selector(hide:)
                       keyEquivalent:@"h"];
  [applicationMenu addItemWithTitle:@"退出"
                              action:@selector(terminate:)
                       keyEquivalent:@"q"];
  applicationMenuItem.submenu = applicationMenu;
  [mainMenu addItem:applicationMenuItem];

  NSMenuItem *viewMenuItem = [[NSMenuItem alloc] initWithTitle:@"显示" action:nil keyEquivalent:@""];
  NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"显示"];
  NSMenuItem *reloadItem = [[NSMenuItem alloc] initWithTitle:@"重新加载"
                                                     action:@selector(reload:)
                                              keyEquivalent:@"r"];
  reloadItem.target = self;
  [viewMenu addItem:reloadItem];
  [viewMenu addItem:[NSMenuItem separatorItem]];
  NSMenuItem *fullScreenItem = [[NSMenuItem alloc] initWithTitle:@"切换全屏"
                                                         action:@selector(toggleFullScreen:)
                                                  keyEquivalent:@"f"];
  fullScreenItem.keyEquivalentModifierMask = NSEventModifierFlagControl | NSEventModifierFlagCommand;
  [viewMenu addItem:fullScreenItem];
  viewMenuItem.submenu = viewMenu;
  [mainMenu addItem:viewMenuItem];

  NSApp.mainMenu = mainMenu;
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  (void)notification;
  [self installApplicationMenu];

  NSURL *resourcesURL = NSBundle.mainBundle.resourceURL;
  NSURL *webDirectoryURL = [resourcesURL URLByAppendingPathComponent:@"web" isDirectory:YES];
  NSURL *indexURL = [webDirectoryURL URLByAppendingPathComponent:@"index.html" isDirectory:NO];
  if (![NSFileManager.defaultManager fileExistsAtPath:indexURL.path]) {
    [self showFatalError:@"应用资源不完整，请重新解压后再试。"];
    return;
  }

  WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
  configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
  configuration.preferences.javaScriptCanOpenWindowsAutomatically = NO;
  // Vite's production output uses ES modules. WebKit keeps file-to-file
  // requests disabled by default, so explicitly allow access within the
  // read-only Resources/web directory passed to loadFileURL below.
  [configuration.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];

  NSRect frame = NSMakeRect(0, 0, 1440, 900);
  self.webView = [[WKWebView alloc] initWithFrame:frame configuration:configuration];
  self.webView.navigationDelegate = self;
  self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  self.webView.allowsMagnification = YES;

  NSWindowStyleMask style = NSWindowStyleMaskTitled |
                            NSWindowStyleMaskClosable |
                            NSWindowStyleMaskMiniaturizable |
                            NSWindowStyleMaskResizable;
  self.window = [[NSWindow alloc] initWithContentRect:frame
                                            styleMask:style
                                              backing:NSBackingStoreBuffered
                                                defer:NO];
  self.window.title = @"雅砻江运维智能体系统";
  self.window.minSize = NSMakeSize(1024, 640);
  self.window.contentView = self.webView;
  self.window.tabbingMode = NSWindowTabbingModeDisallowed;
  [self.window center];
  [self.window makeKeyAndOrderFront:nil];

  [self.webView loadFileURL:indexURL allowingReadAccessToURL:webDirectoryURL];
  [NSApp activateIgnoringOtherApps:YES];
}

- (void)reload:(id)sender {
  (void)sender;
  [self.webView reload];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
  (void)sender;
  return YES;
}

- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)application {
  (void)application;
  return YES;
}

- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
  (void)webView;
  NSURL *url = navigationAction.request.URL;
  BOOL isExternalLink = navigationAction.navigationType == WKNavigationTypeLinkActivated &&
                        ([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"]);
  if (isExternalLink) {
    [NSWorkspace.sharedWorkspace openURL:url];
    decisionHandler(WKNavigationActionPolicyCancel);
    return;
  }
  decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
  (void)navigation;
  if (!self.selfTest) {
    return;
  }

  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
    NSString *script = @"JSON.stringify({"
                        "title: document.title,"
                        "rootChildren: document.getElementById('root')?.childElementCount ?? 0,"
                        "textLength: document.body?.innerText?.length ?? 0,"
                        "hash: location.hash"
                        "})";
    [webView evaluateJavaScript:script completionHandler:^(id result, NSError *error) {
      if (error) {
        fprintf(stderr, "SELF_TEST_ERROR: %s\n", error.localizedDescription.UTF8String);
        fflush(stderr);
        exit(1);
      }

      NSString *json = [result isKindOfClass:NSString.class] ? result : [result description];
      fprintf(stdout, "SELF_TEST_RESULT: %s\n", json.UTF8String);
      fflush(stdout);
      BOOL rendered = [json containsString:@"\"rootChildren\":1"] ||
                      [json containsString:@"\"rootChildren\":2"] ||
                      [json containsString:@"\"rootChildren\":3"];
      exit(rendered ? 0 : 1);
    }];
  });
}

@end

int main(int argc, const char *argv[]) {
  (void)argc;
  (void)argv;
  @autoreleasepool {
    NSApplication *application = NSApplication.sharedApplication;
    OPSAppDelegate *delegate = [[OPSAppDelegate alloc] init];
    for (int index = 1; index < argc; index++) {
      if (strcmp(argv[index], "--self-test") == 0) {
        delegate.selfTest = YES;
      }
    }
    application.delegate = delegate;
    [application run];
  }
  return 0;
}
