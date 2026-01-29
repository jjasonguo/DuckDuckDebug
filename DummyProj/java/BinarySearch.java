public class BinarySearch {
    public static int binarySearch(int[] arr, int target) {
        int left = 0, right = arr.length - 1;

        while (left <= right) {
            int mid = (left + right) / 2;

            if (arr[mid] == target) return mid;
            else if (arr[mid] < target) left = mid;
            else right = mid - 1;
        }

        return -1; // Not found
    }

    public static void main(String[] args) {
        int[] data = {1, 3, 5, 7, 9, 11};
        int target = 7;
        int index = binarySearch(data, target);
        System.out.println("Index of " + target + ": " + index);
    }
}