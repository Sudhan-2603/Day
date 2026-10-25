; Script generated for Day Windows Installer
#define MyAppName "Day"
#define MyAppVersion "0.4.0"
#define MyAppPublisher "Day"
#define MyAppURL "https://github.com/Sudhan-2603/Day"
#define MyAppExeName "Day.exe"

[Setup]
AppId={{E6F74D42-B114-4B7C-A5E8-31A19D7A5D19}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=Day-Setup
OutputDir=.
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=windows\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "Day.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "Day-hook.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
