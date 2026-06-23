# House in Us - Web Platform

## Development Setup

If you want to work locally using your own IDE, you can clone this repo and push changes.

You must have Node.js & npm installed beforehand. We recommend [installing with nvm](https://github.com/nvm-sh/nvm#installing-and-updating) and using Node.js version 20 (LTS).

Follow these steps:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd houseinus-web

# Step 3: Install the necessary dependencies
npm install

# Step 4: Start the development server
npm run dev
```

## Technologies Used

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## "준비 중" 매물 자리채움

메인 페이지의 매물 리스트는 실 DB 매물 뒤에 "준비 중" 상태로 표시되는 하드코딩된 매물("햇살이 머무는 고요한 안식처", "모임의 예술")을 함께 노출한다. 실 매물이 한두 개뿐일 때 그리드가 허전해 보이는 문제를 임시로 막기 위한 장치다.

- 데이터 정의: [src/components/PropertyPlaceholders.tsx](src/components/PropertyPlaceholders.tsx)
- 렌더 위치: [src/components/PropertyListings.tsx](src/components/PropertyListings.tsx) 안의 그리드 마지막

실 매물이 충분히 쌓여서 더 이상 자리채움이 필요 없을 때 제거하는 방법:

1. `PropertyListings.tsx`에서 `PropertyPlaceholders` import 라인과 `<PropertyPlaceholders ... />` 렌더 블록을 삭제(또는 주석 처리)한다.
2. `PropertyPlaceholders.tsx` 파일을 삭제한다.

## Deployment

Deployment is branch-based on `origin`:

- Push to `dev-release` to deploy to the development server.
- Access URL: `https://dev.paretolab.kr`

- Push to `release` to deploy to the production server.
- Access URL: `https://paretolab.kr`

Example:

```sh
git push origin dev-release
# -> deploys to https://dev.paretolab.kr

git push origin release
# -> deploys to https://paretolab.kr
```

You can also update the release branches from local `master` using the publish scripts.

- `npm run publish:dev`
  - Must be started while the current branch is `master`
  - Merges `master` into `dev-release`
  - Pushes `dev-release` to `origin`

- `npm run publish:prod`
  - Must be started while the current branch is `master`
  - Merges `master` into `release`
  - Pushes `release` to `origin`

- `npm run publish`
  - Intentionally does nothing for safety

Example:

```sh
git checkout master
git pull origin master

npm run publish:dev
# -> merges master into dev-release and pushes origin/dev-release

npm run publish:prod
# -> merges master into release and pushes origin/release
```
