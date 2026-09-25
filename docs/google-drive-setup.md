# Connect Google Drive

This is a one-time copy. You pick videos or photos in Google Drive, and the app copies them into the private Supabase bucket for the project selected at the top. It does not watch Drive and it does not sync later.

You do this in a browser on your own computer. The app must be open at **http://localhost:43123**. Google checks that exact address.

Do not paste your Google values into chat. Put them only in `.env.local`. Do not commit that file.

## 1. Open Google Cloud

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com).
2. Sign in with the Gmail account that owns the retreat videos.

## 2. Create a project

1. In the top bar, click the project name (it may say “Select a project”).
2. Click **New project**.
3. Project name: `Retreat Content Library`.
4. Click **Create**.
5. Wait until the project exists, then select it in the top bar so the next steps land in this project.

## 3. Turn on the two APIs

1. Click the menu (three lines) at the top left.
2. Click **APIs & Services**, then **Library**.
3. Search for `Google Drive API`. Open it. Click **Enable**.
4. Click the back arrow, or open **Library** again.
5. Search for `Google Picker API`. Open it. Click **Enable**.

## 4. Set up the Google Auth Platform

The old name was “OAuth consent screen”. The menu is now **Google Auth platform**.

1. Click the menu.
2. Click **Google Auth platform**.
3. If you see **Get started**, click it. If the platform is already set up, skip to the test-user steps below.
4. App name: `Retreat Content Library`.
5. User support email: choose your own Gmail.
6. Click **Next**.
7. Audience: choose **External**. This is for a personal Gmail account. Click **Next**.
8. Contact email: your Gmail again. Click **Next**.
9. Agree to the user data policy. Click **Create** (or **Continue**, then **Create**).

Leave the app in **Testing**. Do not click **Publish**.

### Add yourself as a test user

1. In **Google Auth platform**, click **Audience**.
2. Under **Test users**, click **Add users**.
3. Type your own Gmail address. Click **Save**.

Only that Gmail can use the import while the app stays in Testing.

### Allow the Drive file scope

1. In **Google Auth platform**, click **Data Access**.
2. Click **Add or remove scopes**.
3. Find or paste this exact scope:

   `https://www.googleapis.com/auth/drive.file`

4. Tick that scope. It only covers files you pick in the window. It does not grant your whole Drive.
5. Click **Update**, then **Save**.

## 5. What you will see the first time you sign in

Google will say the app is not verified, because this is your own test app. That is expected.

1. On the screen that says **Google hasn’t verified this app**, click **Advanced**.
2. Click **Go to Retreat Content Library (unsafe)**.
3. If you instead see a screen that says the app is in testing, click **Continue**.
4. Tick the Drive permission and click **Continue** or **Allow**.

You only need to do this for the Gmail you added as a test user.

## 6. Create the OAuth client

1. Click the menu, then **Google Auth platform**, then **Clients**.
2. Click **Create client**.
3. Application type: **Web application**.
4. Name: `Retreat Content Library local`.
5. Under **Authorized JavaScript origins**, click **Add URI**.
6. Enter exactly:

   `http://localhost:43123`

7. Leave **Authorized redirect URIs** empty. This app does not use a redirect.
8. Click **Create**.
9. Copy the **Client ID**. It is a long string ending in `.apps.googleusercontent.com`.
10. You do not need a client secret for this. If Google shows one, do not put it in the app.

## 7. Create the API key

The Picker window needs an API key. Your videos are still downloaded with the sign-in token, not with this key.

1. Click the menu, then **APIs & Services**, then **Credentials**.
2. Click **Create credentials**, then **API key**.
3. Copy the key when it appears.
4. Click **Edit API key** (on that message, or click the key name in the list).
5. Under **API restrictions**, choose **Restrict key**.
6. Tick **Google Picker API** and **Google Drive API**.
7. Click **Save**.

If you already saved the key with only Google Drive API ticked, the Picker window says the API key is invalid. Open that key, tick **Google Picker API** as well, and click **Save**. That is the one click that fixes it. The app still sends the key, because Google’s Picker requires it.

Do not turn on website restrictions unless you know you need them. If you do, you must allow both `http://localhost:43123/*` and `https://docs.google.com/*`. The Picker opens inside a Google page. Without `docs.google.com`, Google says the API key is invalid.

## 8. Copy the project number

1. In the top bar, click the project name.
2. Find **Project number**. It is only digits, such as `123456789012`.
3. Copy that number. Do not copy the **Project ID**. The ID has words in it.

This number is what the app calls the App ID.

## 9. Paste the three values and restart

1. In the project folder on your computer, open `.env.local`.
2. Fill in these three lines. Do not add quotes.

   `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` the Client ID from step 6

   `NEXT_PUBLIC_GOOGLE_API_KEY=` the API key from step 7

   `NEXT_PUBLIC_GOOGLE_APP_ID=` the project number from step 8

3. Save the file.
4. In the terminal where the app is running, press Ctrl+C.
5. Run `npm run dev` again.
6. Open [http://localhost:43123](http://localhost:43123). Pick a project at the top. Open **Upload**. The button should say **Import from Google Drive**.

If the button still says **Google Drive not connected yet — see setup guide**, one of the three lines is empty, or the app was not restarted.

## 10. Import

1. Choose **Ibiza Pole Retreat**, **Phuket Pole Retreat**, or **Flirty Fitness** at the top.
2. Click **Import from Google Drive**.
3. Sign in, click through the “not verified” screen as in step 5, and allow the Drive permission.
4. The first tab is **Videos**. **Photos** is the second tab. You can select more than one file.
5. The app checks each file’s size in Drive before it downloads it. A file over 50 MB is skipped and named in the summary. Nothing over 50 MB is downloaded.
6. Imported files show up in the Media Library for that project.

The free Supabase plan holds about 1 GB for all files together, and 50 MB for each file.
