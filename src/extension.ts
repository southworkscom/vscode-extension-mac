'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// Node Lib
const request = require("request");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Image Generator

const AdmZip = require('adm-zip');
const FormData = require("form-data");



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "pwa-builder-mac" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json

    // ------------  IMAGE GENERATOR ---------------------------

    let inputBox = vscode.commands.registerCommand('extension.imageGenerator', () => {

        const apiUrl = 'http://appimagegenerator-pre.azurewebsites.net/'; // 'http://localhost:49080/';

        let extractPath = '';
        let manifestFilePath = '';

        vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: "Select image",
            filters: {
                'Images': ['bmp', 'png', 'jpg', 'jpeg']
            }
        })
            .then(function (result: any) {

                let imgUrl = result[0].fsPath;


                if (imgUrl != '') {

                    try {

                        const formData = new FormData()

                        formData.append('fileName', fs.createReadStream(imgUrl));

                        // Platforms input

                        vscode.window.showQuickPick(["iOS", "Windows", "Windows10", "Android", "Chrome", "Firefox"], { canPickMany: true })
                            .then(function (result: any) {
                                if (result != '') {

                                    for (let i = 0; i < result.length; i++) {
                                        formData.append('platform', (result[i]).toLowerCase());
                                    }

                                    inputPadding();
                                } else {
                                    vscode.window.showErrorMessage("No platform was chosen.")
                                }
                            });



                        // Padding input
                        let inputPadding = function () {

                            vscode.window.showInputBox({ prompt: '0 is no padding, 1 is 100% of the source image. 0.3 is a typical value for most icons', placeHolder: '0.3' })
                                .then(function (resultPadding) {
                                    let predetPadding = '0.3';

                                    if (resultPadding != undefined && resultPadding != null && resultPadding != '') {
                                        if (parseFloat(resultPadding) < 0 || parseFloat(resultPadding) > 0) {
                                            vscode.window.showErrorMessage("Incorrect padding value. It must be between 0 and 1.")
                                        } else {
                                            formData.append('padding', resultPadding);
                                            inputColorOption();

                                        }
                                    } else {
                                        formData.append('padding', predetPadding);
                                        inputColorOption();

                                    }

                                })
                        };
                        // Image Background
                        let inputColorOption = function () {
                            vscode.window.showQuickPick(["Transparent", "Custom Color"], { canPickMany: false })
                                .then(function (result) {
                                    let color = '';
                                    let colorOption = '0';
                                    let colorChanged = '0';

                                    if (result == "Custom Color") {

                                        vscode.window.showInputBox({ prompt: 'Insert the hexadecimal code. Ex: #123456' })
                                            .then(function (resultColor: any) {

                                                if (resultColor.substring(0, 1) == '#' && resultColor.length == 7) {

                                                    color = resultColor;
                                                    colorOption = '1';
                                                    colorChanged = '1';

                                                    formData.append('colorOption', colorOption);
                                                    formData.append('colorChanged', colorChanged);
                                                    formData.append('color', color);

                                                    setExtractPath();
                                                } else {
                                                    vscode.window.showErrorMessage("Invalid value, it must be like #123456.")
                                                }

                                            })
                                    } else {

                                        formData.append('colorOption', colorOption);
                                        formData.append('colorChanged', colorChanged);
                                        formData.append('color', color);
                                        setExtractPath();

                                    }
                                })
                        };

                        // Select of extraction path

                        let setExtractPath = function () {
                            vscode.window.showOpenDialog({
                                canSelectFiles: false,
                                canSelectFolders: true,
                                canSelectMany: false,
                                openLabel: "Select Assets Path",

                            })
                                .then(function (result: any) {

                                    extractPath = result[0].path.substring(1);
                                    let folderName: any = extractPath.split('/').pop();
                                    if (folderName.toLowerCase() == 'assets') {
                                        setManifestPath();
                                    } else {
                                        vscode.window.showErrorMessage("Wrong folder name. It must be the Assets folder.")
                                    }


                                })
                        }
                        // Select of manifest path
                        let setManifestPath = function () {
                            vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                openLabel: "Select the Manifest file",

                            })
                                .then(function (result: any) {
                                    manifestFilePath = result[0].path.substring(1);
                                    let fileNameManifest: any = manifestFilePath.split('/').pop(); //FileName with extension
                                    let extensionFile = fileNameManifest.split('.').pop(); // Extension

                                    if (extensionFile.toLowerCase() == 'json') {
                                        sendToApi();
                                    } else {
                                        vscode.window.showErrorMessage("Invalid Manifest format");
                                    }
                                })
                        }


                        let sendToApi = function () {
                            console.log('send to api')
                            request.post(apiUrl + 'api/image/', {
                                body: formData,
                                headers: formData.getHeaders()

                            }, function (err: any, res: any) {

                                const resultZipUri = JSON.parse(res.body).Uri;

                                try {

                                    let newFileName = 'AppImages';
                                    var tmpFilePath = extractPath + "/" + newFileName + '.zip';

                                    http.get(apiUrl + resultZipUri.substring(1), function (response: any) {
                                        response.on('data', function (data: any) {

                                            fs.appendFileSync(tmpFilePath, data)

                                        });
                                        response.on('end', function () {

                                            try {
                                                if (tmpFilePath) {

                                                    var zip = new AdmZip(tmpFilePath)

                                                    vscode.window.showInformationMessage('Extracting images')

                                                    zip.extractAllTo(extractPath, true)

                                                    fs.unlink(tmpFilePath)

                                                    let jsonManifest = JSON.parse(fs.readFileSync(manifestFilePath, function (err: any, data: any) { if (err) { throw err; } }))

                                                    let jsonIcons = JSON.parse(fs.readFileSync(extractPath + '/icons.json', function (err: any, data: any) { if (err) { throw err; } }))

                                                    jsonManifest.icons = jsonIcons.icons;

                                                    vscode.window.showInformationMessage('Updating manifest')

                                                    fs.writeFileSync(manifestFilePath, JSON.stringify(jsonManifest))

                                                    vscode.window.showInformationMessage("Manifest update complete.")
                                                }

                                            } catch (error) {
                                                vscode.window.showErrorMessage("error catch" + error)
                                                console.log("error catch", error)
                                            }
                                        })
                                    });

                                }

                                catch (err) {
                                    vscode.window.showInformationMessage("Error on Zip Request: " + err)
                                }
                            });
                        };

                    } catch (error) {
                        vscode.window.showInformationMessage('Error: ' + error)
                    }
                } else {
                    vscode.window.showInformationMessage("No image selected")
                }

            })


    });
    // -------------------- END IMAGE GENERATOR -------------------------------------

    context.subscriptions.push();
}

// this method is called when your extension is deactivated
export function deactivate() {
}