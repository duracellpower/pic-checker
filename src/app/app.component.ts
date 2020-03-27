import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  EventEmitter,
  ChangeDetectorRef
} from "@angular/core";
import * as AWS from "aws-sdk";
import { fromEvent, Observable } from "rxjs";
import { switchMap, map, tap } from "rxjs/operators";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent implements AfterViewInit {
  picLabels$: Observable<AWS.Rekognition.Labels>;
  isLoading = false;
  noImageYet = true;
  isLoggedIn = false;
  upload$ = new EventEmitter();

  @ViewChild("fileToUpload", { static: false })
  fileToUpload: ElementRef<HTMLInputElement>;

  @ViewChild("imagePreview", { static: false })
  imagePreview: ElementRef<HTMLImageElement>;

  constructor(private cd: ChangeDetectorRef) {}

  public ngAfterViewInit() {
    // Render login button via the google api library
    gapi.signin2.render("loginButton", {
      scope: "profile email",
      width: 240,
      height: 50,
      longtitle: true,
      theme: "light",
      onsuccess: () => this.onLoggedIn()
    });
    fromEvent(this.fileToUpload.nativeElement, "change").subscribe(
      () => (this.noImageYet = false)
    );
    this.picLabels$ = this.upload$.pipe(
      switchMap(() => {
        // Loading setzen bevor der API Aufruf gemacht wird
        this.isLoading = true;
        return processImage(
          this.fileToUpload.nativeElement,
          this.imagePreview.nativeElement
        );
      }),
      map(results => {
        // API Aufruf ist fertig und Loading kann ausgeschalten werden
        this.isLoading = false;
        return Object.keys(results).map(key => results[key]);
      }),
    );
  }

  onLoggedIn() {
    this.isLoggedIn = true;
    this.cd.detectChanges();
  }

  logout() {
    const auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut();
    this.isLoggedIn = false;
  }
}

//Calls DetectFaces API and shows estimated ages of detected faces
function processLabels(
  imageData: ArrayBuffer
): Promise<AWS.Rekognition.Labels> {
  const rekognition = new AWS.Rekognition();
  const params = {
    Image: {
      Bytes: imageData
    }
  };
  return new Promise((resolve, reject) => {
    rekognition.detectLabels(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
        reject(err);
      }
      // an error occurred
      else {
        resolve(data.Labels);
      }
    });
  });
}

//Loads selected image and unencodes image bytes for Rekognition DetectFaces API
function processImage(
  control: HTMLInputElement,
  imagePreview: HTMLImageElement
): Promise<AWS.Rekognition.Labels> {
  anonymousLogin();
  const file = control.files[0];

  // Load base64 encoded image
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (function(theFile) {
      return function(e: any) {
        let image = null;
        imagePreview.src = e.target.result;
        let jpg = true;
        try {
          image = atob(e.target.result.split("data:image/jpeg;base64,")[1]);
        } catch (e) {
          jpg = false;
        }
        if (jpg == false) {
          try {
            image = atob(e.target.result.split("data:image/png;base64,")[1]);
          } catch (e) {
            alert("Not an image file Rekognition can process");
            return;
          }
        }
        //unencode image bytes for Rekognition DetectFaces API
        const length = image.length;
        const imageBytes = new ArrayBuffer(length);
        const ua = new Uint8Array(imageBytes);
        for (let i = 0; i < length; i++) {
          ua[i] = image.charCodeAt(i);
        }
        //Call Rekognition
        processLabels(imageBytes).then(resolve, reject);
      };
    })(file);
    reader.readAsDataURL(file);
  });
}

//Provides anonymous log on to AWS services
function anonymousLogin() {
  // Configure the credentials provider to use your identity pool
  AWS.config.region = "us-east-2"; // Region
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: "us-east-2:7f724284-f43f-47bd-8a42-870f7d4a6831"
  });

  // Credentials will be available when this function is called.
  AWS.config.credentials.accessKeyId = AWS.config.credentials.accessKeyId;
  AWS.config.credentials.secretAccessKey =
    AWS.config.credentials.secretAccessKey;
  AWS.config.credentials.sessionToken = AWS.config.credentials.sessionToken;
}
